const { createServer } = require("http");
const { parse } = require("url");
const fs = require("fs");
const path = require("path");
const next = require("next");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { loadEnvConfig } = require("@next/env");

// Load .env files into process.env
loadEnvConfig(process.cwd());

// Determine production vs development mode
const hasBuild = fs.existsSync(path.join(__dirname, ".next", "BUILD_ID"));
const dev = process.env.NODE_ENV === "development" || (!hasBuild && process.env.NODE_ENV !== "production");
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`> Initializing Hack The Horizon 2.0 [Mode: ${dev ? "DEVELOPMENT" : "PRODUCTION"}]...`);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  // Voice Session State
  let voiceSession = {
    active: false,
    sessionId: null,
    adminId: null,
    adminName: null,
    adminSocketId: null,
    startedAt: null,
    isMuted: false,
  };

  // Connected Displays Registry (Map: socketId -> displayInfo)
  const connectedDisplays = new Map();

  const broadcastDisplayUpdate = () => {
    const list = Array.from(connectedDisplays.values());
    io.emit("smart-boards-updated", {
      boards: list,
      connectedCount: list.filter((b) => b.status === "CONNECTED").length,
      totalExpected: 24,
    });
  };

  io.on("connection", (socket) => {
    // Client can join a specific room (e.g. 'admin', 'smart-board', 'participant')
    socket.on("join-room", (room) => {
      socket.join(room);
    });

    // 1. Initial State Synchronization (REQUEST_CURRENT_STATE / SERVER_STATE_SYNC)
    const sendStateSync = async (targetSocket, callback) => {
      try {
        const now = new Date();
        const currentEvent = await prisma.event.findFirst({
          where: { startTime: { lte: now }, endTime: { gt: now } },
          orderBy: { priority: "desc" },
        });
        const nextEvent = await prisma.event.findFirst({
          where: { startTime: { gt: now } },
          orderBy: { startTime: "asc" },
        });
        const recentAlerts = await prisma.alert.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        const venues = await prisma.venue.findMany({
          orderBy: { venueCode: "asc" },
        });
        const displayConfig = await prisma.displayConfig.findUnique({
          where: { id: "global" },
        });

        const syncPayload = {
          currentEvent,
          nextEvent,
          serverTime: now.toISOString(),
          recentAlerts,
          voiceSession,
          venues,
          displayConfig: displayConfig || {
            showCountdown: true,
            showSchedule: true,
            showAlertCentre: true,
            showLogo: true,
            customAnnouncement: "",
          },
        };

        if (typeof callback === "function") {
          callback(syncPayload);
        }
        targetSocket.emit("SERVER_STATE_SYNC", syncPayload);
      } catch (err) {
        console.error("State sync error:", err);
      }
    };

    socket.on("REQUEST_CURRENT_STATE", (callback) => {
      sendStateSync(socket, callback);
    });

    // 2. Smart Board Display Registration with 13 Venue Architecture
    socket.on("register-display", (data) => {
      const venueCode = data?.venueCode || "VENUE-01";
      const displayId = data?.displayId || `DISPLAY-01`;
      const displayName = data?.displayName || `${venueCode} / ${displayId}`;

      const boardInfo = {
        socketId: socket.id,
        venueCode,
        displayId,
        displayName,
        connectedAt: new Date().toISOString(),
        status: "CONNECTED",
        metadata: data?.metadata || {},
      };

      connectedDisplays.set(socket.id, boardInfo);

      // Join targeted audience rooms
      socket.join("smart-board");
      socket.join("all-displays");
      socket.join(`venue:${venueCode}`);
      socket.join(`display:${venueCode}:${displayId}`);

      broadcastDisplayUpdate();
      io.emit("DISPLAY_CONNECTED", { display: boardInfo });
      const activeForVenue = Array.from(connectedDisplays.values()).filter(
        (d) => d.venueCode === venueCode && d.status === "CONNECTED"
      );
      io.emit("VENUE_UPDATED", {
        venueCode,
        status: "ONLINE",
        connectedDisplaysCount: activeForVenue.length,
      });

      // Send authoritative state sync immediately to newly registered display
      sendStateSync(socket);
    });

    // 3. Query Voice State
    socket.on("voice-get-state", (callback) => {
      if (typeof callback === "function") {
        callback(voiceSession);
      }
    });

    // 4. Central Voice Session Lock & Database Persistence
    socket.on("voice-start-session", async (data, callback) => {
      if (voiceSession.active && voiceSession.adminSocketId !== socket.id) {
        if (typeof callback === "function") {
          callback({
            success: false,
            error: "CONTROLLED_BY_ANOTHER_ADMIN",
            owner: voiceSession.adminName,
          });
        }
        return;
      }

      const sessionId = data?.sessionId || `session-${Date.now()}`;
      voiceSession = {
        active: true,
        sessionId,
        adminId: data.adminId || "admin-1",
        adminName: data.adminName || "Organizer",
        adminSocketId: socket.id,
        startedAt: new Date().toISOString(),
        isMuted: false,
        channel: data.channel || "ALL",
      };

      try {
        await prisma.voiceSession.create({
          data: {
            sessionId,
            adminId: voiceSession.adminId,
            adminName: voiceSession.adminName,
            status: "ACTIVE",
            roomName: "hth-central-voice",
            channel: voiceSession.channel,
            startedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn("DB VoiceSession logging warning:", err.message);
      }

      io.emit("voice-session-started", { session: voiceSession });
      io.emit("VOICE_STARTED", { session: voiceSession });

      if (typeof callback === "function") {
        callback({ success: true, session: voiceSession });
      }
    });

    // 5. Request Control from another admin
    socket.on("voice-request-control", (data) => {
      if (voiceSession.active && voiceSession.adminSocketId) {
        io.to(voiceSession.adminSocketId).emit("voice-control-requested", {
          requestingAdmin: data?.adminName || "Another Admin",
        });
      }
    });

    // 6. Voice Mute Toggle
    socket.on("voice-mute-toggle", async (data) => {
      if (voiceSession.active && voiceSession.adminSocketId === socket.id) {
        voiceSession.isMuted = !!data.isMuted;
        try {
          await prisma.voiceSession.updateMany({
            where: { sessionId: voiceSession.sessionId },
            data: { status: voiceSession.isMuted ? "MUTED" : "ACTIVE" },
          });
        } catch (e) {}

        io.emit("voice-mute-updated", { isMuted: voiceSession.isMuted });
        io.emit(voiceSession.isMuted ? "VOICE_MUTED" : "VOICE_UNMUTED", {
          isMuted: voiceSession.isMuted,
        });
      }
    });

    // 7. Voice End Session
    const endVoiceSession = async () => {
      if (voiceSession.active) {
        const endedId = voiceSession.sessionId;
        voiceSession = {
          active: false,
          sessionId: null,
          adminId: null,
          adminName: null,
          adminSocketId: null,
          startedAt: null,
          isMuted: false,
        };

        if (endedId) {
          try {
            await prisma.voiceSession.updateMany({
              where: { sessionId: endedId },
              data: { status: "ENDED", endedAt: new Date() },
            });
          } catch (e) {}
        }

        io.emit("voice-session-ended");
        io.emit("VOICE_ENDED");
      }
    };

    socket.on("voice-end-session", () => {
      if (voiceSession.active && voiceSession.adminSocketId === socket.id) {
        endVoiceSession();
      }
    });

    socket.on("disconnect", () => {
      // If active voice admin disconnects, terminate broadcast safely
      if (voiceSession.active && voiceSession.adminSocketId === socket.id) {
        endVoiceSession();
      }

      // If registered smart board disconnects
      if (connectedDisplays.has(socket.id)) {
        const display = connectedDisplays.get(socket.id);
        connectedDisplays.delete(socket.id);
        broadcastDisplayUpdate();
        io.emit("DISPLAY_DISCONNECTED", { socketId: socket.id, display });

        // Check if venue still has active displays
        const remaining = Array.from(connectedDisplays.values()).filter(
          (d) => d.venueCode === display.venueCode && d.status === "CONNECTED"
        );
        const venueStatus = remaining.length > 0 ? "ONLINE" : "OFFLINE";
        io.emit("VENUE_UPDATED", {
          venueCode: display.venueCode,
          status: venueStatus,
          connectedDisplaysCount: remaining.length,
        });
      }
    });
  });

  // Attach io and connectedDisplays to global so API routes can use it
  global.io = io;
  global.connectedDisplays = connectedDisplays;

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
