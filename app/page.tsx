"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EventCountdown, { EventType } from "@/components/EventCountdown";
import JarvisOrb, { JarvisState } from "@/components/JarvisOrb";
import OmnitrixAlertOverlay, { AlertType } from "@/components/OmnitrixAlertOverlay";
import AlertCentreFeed from "@/components/AlertCentreFeed";
import { SmartBoardVoiceReceiver, VoiceStats } from "@/lib/voiceClient";
import { getSocket } from "@/lib/socket";
import { getAudioContext } from "@/lib/soundFX";
import { Radio, Volume2, Tv, Wifi, ShieldAlert, Sparkles } from "lucide-react";

export interface DisplayConfig {
  showCountdown: boolean;
  showSchedule: boolean;
  showAlertCentre: boolean;
  showLogo: boolean;
  customAnnouncement?: string;
}

export default function EndScreen() {
  const [voiceState, setVoiceState] = useState<JarvisState>("STANDBY");
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const [voiceStats, setVoiceStats] = useState<VoiceStats | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<"CONNECTED" | "RECONNECTING" | "OFFLINE">("CONNECTED");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Authoritative event state from server
  const [currentEvent, setCurrentEvent] = useState<EventType | null>(null);
  const [nextEvent, setNextEvent] = useState<EventType | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);

  // 13-Venue Identity State
  const [venueCode, setVenueCode] = useState<string>("VENUE-01");
  const [displayId, setDisplayId] = useState<string>("DISPLAY-01");
  const [venueName, setVenueName] = useState<string>("Main Auditorium");
  const [trackName, setTrackName] = useState<string>("Gen AI & Machine Learning Track");

  // Admin-Controllable Live Display Configuration
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({
    showCountdown: true,
    showSchedule: true,
    showAlertCentre: true,
    showLogo: true,
    customAnnouncement: "",
  });

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const voiceReceiverRef = useRef<SmartBoardVoiceReceiver | null>(null);

  // Read Venue and Display identity on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlVenue = searchParams.get("venue");
      const urlDisplay = searchParams.get("display");

      const savedVenue = localStorage.getItem("hth_venue_code");
      const savedDisplay = localStorage.getItem("hth_display_id");

      const finalVenue = urlVenue || savedVenue || "VENUE-01";
      const finalDisplay = urlDisplay || savedDisplay || "DISPLAY-01";

      setVenueCode(finalVenue);
      setDisplayId(finalDisplay);

      localStorage.setItem("hth_venue_code", finalVenue);
      localStorage.setItem("hth_display_id", finalDisplay);
    }
  }, []);

  // Initialize Socket.io and Real-time Event Listeners
  useEffect(() => {
    const socket = getSocket();

    // 1. Initial State Sync Handler
    const handleStateSync = (data: {
      currentEvent?: EventType | null;
      nextEvent?: EventType | null;
      serverTime?: string;
      recentAlerts?: AlertType[];
      voiceSession?: { active: boolean; isMuted: boolean };
      venues?: any[];
      displayConfig?: DisplayConfig;
    }) => {
      if (data.currentEvent !== undefined) setCurrentEvent(data.currentEvent);
      if (data.nextEvent !== undefined) setNextEvent(data.nextEvent);
      if (data.serverTime) setServerTime(data.serverTime);
      if (data.recentAlerts && Array.isArray(data.recentAlerts)) {
        setRecentAlerts(data.recentAlerts);
      }
      if (data.displayConfig) {
        setDisplayConfig(data.displayConfig);
      }
      if (data.venues && Array.isArray(data.venues)) {
        const currentVenue = data.venues.find((v: any) => v.venueCode === venueCode);
        if (currentVenue) {
          if (currentVenue.venueName) setVenueName(currentVenue.venueName);
          if (currentVenue.trackName) setTrackName(currentVenue.trackName);
        }
      }
      if (data.voiceSession) {
        if (data.voiceSession.active) {
          setVoiceState(data.voiceSession.isMuted ? "CONNECTED" : "SPEAKING");
        } else {
          setVoiceState("STANDBY");
        }
      }
    };

    socket.on("SERVER_STATE_SYNC", handleStateSync);

    // 2. Connection Lifecycle & Registration
    const registerWithBackend = () => {
      setConnectionStatus("CONNECTED");
      socket.emit("register-display", {
        venueCode,
        displayId,
        displayName: `${venueCode} / ${displayId}`,
        metadata: {
          resolution: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "1080p",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });
      socket.emit("REQUEST_CURRENT_STATE", handleStateSync);
    };

    socket.on("connect", registerWithBackend);
    socket.on("disconnect", () => setConnectionStatus("RECONNECTING"));
    socket.on("connect_error", () => setConnectionStatus("RECONNECTING"));

    // Register immediately if already connected
    if (socket.connected) {
      registerWithBackend();
    }

    // 3. Realtime Display Configuration Listener (Admin Toggles)
    const handleDisplayConfigUpdated = (data: { config: DisplayConfig }) => {
      if (data?.config) {
        setDisplayConfig(data.config);
      }
    };
    socket.on("DISPLAY_CONFIG_UPDATED", handleDisplayConfigUpdated);

    // 4. Realtime Schedule & Event Listeners
    const handleEventsUpdated = (data: any) => {
      if (data?.currentEvent !== undefined) setCurrentEvent(data.currentEvent);
      if (data?.nextEvent !== undefined) setNextEvent(data.nextEvent);
    };
    socket.on("EVENT_CREATED", handleEventsUpdated);
    socket.on("EVENT_UPDATED", handleEventsUpdated);
    socket.on("EVENT_DELETED", handleEventsUpdated);
    socket.on("SCHEDULE_UPDATED", handleEventsUpdated);

    // 5. Realtime Alert Listeners
    const handleAlertCreated = (data: { alert: AlertType }) => {
      if (!data?.alert) return;
      setRecentAlerts((prev) => [data.alert, ...prev.filter((a) => a.id !== data.alert.id)]);
    };

    const handleAlertUpdated = (data: { alert: AlertType }) => {
      if (!data?.alert) return;
      setRecentAlerts((prev) =>
        prev.map((a) => (a.id === data.alert.id ? { ...a, ...data.alert } : a))
      );
    };

    const handleAlertDeleted = (data: { id: string }) => {
      if (!data?.id) return;
      setRecentAlerts((prev) => prev.filter((a) => a.id !== data.id));
    };

    socket.on("ALERT_CREATED", handleAlertCreated);
    socket.on("ALERT_UPDATED", handleAlertUpdated);
    socket.on("ALERT_DELETED", handleAlertDeleted);
    socket.on("ALERT_ARCHIVED", handleAlertDeleted);

    // 6. Initialize WebRTC Voice Receiver
    const receiver = new SmartBoardVoiceReceiver({
      audioElement: audioElRef.current,
      onTrack: (stream) => {
        setRemoteAudioStream(stream);
      },
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onStats: (stats) => {
        setVoiceStats(stats);
      },
      onPlaybackBlocked: () => {
        setAudioUnlocked(false);
      },
    });

    voiceReceiverRef.current = receiver;
    receiver.init(venueCode, displayId);

    return () => {
      receiver.destroy();
      socket.off("SERVER_STATE_SYNC", handleStateSync);
      socket.off("connect", registerWithBackend);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("DISPLAY_CONFIG_UPDATED", handleDisplayConfigUpdated);
      socket.off("EVENT_CREATED", handleEventsUpdated);
      socket.off("EVENT_UPDATED", handleEventsUpdated);
      socket.off("EVENT_DELETED", handleEventsUpdated);
      socket.off("SCHEDULE_UPDATED", handleEventsUpdated);
      socket.off("ALERT_CREATED", handleAlertCreated);
      socket.off("ALERT_UPDATED", handleAlertUpdated);
      socket.off("ALERT_DELETED", handleAlertDeleted);
      socket.off("ALERT_ARCHIVED", handleAlertDeleted);
    };
  }, [venueCode, displayId]);

  // Unlock AudioContext for autoplay on Smart Boards
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    setAudioUnlocked(true);
    if (audioElRef.current) {
      audioElRef.current.muted = false;
      audioElRef.current.volume = 1.0;
      audioElRef.current.play().catch(() => {});
    }
  };

  // Global user interaction listener to automatically unlock audio on first touch/click
  useEffect(() => {
    const handleGlobalInteraction = () => {
      unlockAudio();
    };
    window.addEventListener("click", handleGlobalInteraction);
    window.addEventListener("touchstart", handleGlobalInteraction);
    window.addEventListener("keydown", handleGlobalInteraction);
    return () => {
      window.removeEventListener("click", handleGlobalInteraction);
      window.removeEventListener("touchstart", handleGlobalInteraction);
      window.removeEventListener("keydown", handleGlobalInteraction);
    };
  }, []);

  // Fullscreen toggle for 16:9 Smart Board displays (1080p and 4K)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleAlertFinished = (alert: AlertType) => {
    setRecentAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  };

  const isCentralVoiceActive =
    voiceState === "SPEAKING" || voiceState === "CONNECTING" || voiceState === "CONNECTED";

  return (
    <main className="flex min-h-screen flex-col justify-between p-4 sm:p-6 md:p-8 relative overflow-hidden bg-black text-white select-none">
      {/* Background Graphic Image: endscreen-background.png */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: "url('/endscreen-background.png')" }}
      />
      {/* Subtle overlay gradient to ensure high legibility of countdown & telemetry */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none z-0" />

      {/* Non-display-none Audio element for bulletproof WebRTC playback across Smart TVs */}
      <audio
        ref={audioElRef}
        autoPlay
        playsInline
        preload="auto"
        className="fixed -top-96 -left-96 opacity-0 pointer-events-none"
      />

      {/* Prominent floating un-mute banner if audio policy blocks autoplay during voice announcement */}
      {isCentralVoiceActive && !audioUnlocked && (
        <div
          onClick={unlockAudio}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full bg-red-600 text-white font-mono font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_40px_rgba(239,68,68,0.9)] cursor-pointer animate-bounce flex items-center gap-3 border-2 border-white hover:bg-red-500 transition-all"
        >
          <Volume2 className="w-5 h-5 animate-pulse" />
          <span>🔊 LIVE VOICE BROADCAST IN PROGRESS — CLICK ANYWHERE TO HEAR</span>
        </div>
      )}

      {/* Omnitrix-Inspired Circular Sci-Fi Alert Overlay */}
      <OmnitrixAlertOverlay onAlertFinished={handleAlertFinished} />

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-green/10 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-neon-cyan/10 rounded-full blur-[180px] pointer-events-none" />

      {/* =========================================================================
          1. HEADER REGION (NON-OVERLAPPING FLEX CONTAINER)
          Top-Left: Hack The Horizon & KPR Logos
          Top-Right: Dedicated Venue Identity & Connection Telemetry Badge
          ========================================================================= */}
      <header className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 z-20 pb-4 border-b border-white/5">
        {/* Top-Left Branding */}
        {displayConfig.showLogo ? (
          <div className="flex items-center gap-4">
            <img
              src="/kpr.png"
              alt="KPR Logo"
              className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.25)]"
            />
            <div className="h-8 border-l border-white/20" />
            <img
              src="/logo.png"
              alt="Hack The Horizon 2.0"
              className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-[0_0_20px_rgba(57,255,20,0.4)]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-neon-green font-mono font-black text-sm uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>HACK THE HORIZON 2.0</span>
          </div>
        )}

        {/* Top-Right Venue Identity & Telemetry Indicator (Never Overlaps) */}
        <div className="flex items-center gap-3">
          <img
            src="/cis.png"
            alt="IEEE CIS Logo"
            className="h-8 sm:h-10 md:h-12 w-auto object-contain hidden md:block drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          />

          {/* Dedicated Telemetry Pill */}
          <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl shadow-xl">
            {/* Status dot */}
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === "CONNECTED"
                  ? "bg-neon-green animate-pulse shadow-[0_0_8px_#39ff14]"
                  : "bg-yellow-400 animate-ping"
              }`}
            />

            {/* Venue Tag */}
            <div className="flex flex-col text-left">
              <span className="font-mono font-black text-xs text-white tracking-wider flex items-center gap-1.5">
                <span className="text-neon-cyan">{venueCode}</span>
                <span className="text-gray-400">•</span>
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{venueName}</span>
              </span>
              <span className="font-mono text-[10px] text-gray-400 tracking-widest uppercase">
                {displayId} // {connectionStatus === "CONNECTED" ? "ONLINE" : "RECONNECTING..."}
              </span>
            </div>

            {/* Voice Active Badge */}
            {isCentralVoiceActive && (
              <span className="font-mono text-[10px] text-red-400 font-bold border-l border-white/20 pl-2.5 animate-pulse flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">VOICE LIVE</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. CENTRAL VOICE (JARVIS) DYNAMIC MODAL / OVERLAY
          Smoothly appears ONLY when admin starts Central Voice
          ========================================================================= */}
      <AnimatePresence>
        {isCentralVoiceActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center justify-center p-10 md:p-16 rounded-3xl bg-black/90 border-2 border-neon-green/60 shadow-[0_0_80px_rgba(57,255,20,0.4)] max-w-2xl w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-green" />

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 font-mono font-bold text-xs uppercase mb-8 animate-pulse">
                <Volume2 className="w-4 h-4" />
                <span>CENTRAL VOICE BROADCAST // ALL 13 VENUES</span>
              </div>

              {/* JARVIS Amplitude Reactive Orb */}
              <JarvisOrb
                state={voiceState}
                audioStream={remoteAudioStream}
                size="xl"
                labelOverride={
                  voiceState === "SPEAKING"
                    ? "CENTRAL VOICE ACTIVE"
                    : voiceState === "CONNECTED"
                    ? "VOICE MUTED"
                    : "CONNECTING..."
                }
              />

              <div className="mt-8 text-sm font-mono text-gray-300">
                Please listen to the central announcement from the command centre.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          3. CENTER REGION: COUNTDOWN & TRACK DETAILS
          Visually dominant, scalable from 1080p to 4K
          ========================================================================= */}
      <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center justify-center gap-6 my-4 z-10">
        {/* Track Designation Pill */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest uppercase text-neon-cyan shadow-sm">
          <span>{trackName}</span>
          <span className="text-gray-500">//</span>
          <span className="text-gray-300">{venueCode}</span>
        </div>

        {/* Live Admin Announcement Ticker (If Configured) */}
        {displayConfig.customAnnouncement && displayConfig.customAnnouncement.trim() && (
          <div className="w-full max-w-4xl px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan font-mono text-xs text-center uppercase tracking-wider animate-pulse">
            📢 {displayConfig.customAnnouncement}
          </div>
        )}

        {/* Visually Dominant Event Countdown (Controlled by Admin Toggles) */}
        {displayConfig.showCountdown ? (
          <EventCountdown
            initialCurrentEvent={currentEvent}
            initialNextEvent={nextEvent}
            initialServerTime={serverTime}
          />
        ) : (
          <div className="py-12 px-8 rounded-3xl bg-black/60 border border-white/10 text-center font-mono max-w-2xl">
            <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-2">
              {currentEvent ? currentEvent.title : "HACK THE HORIZON 2.0"}
            </h2>
            <p className="text-sm text-gray-400">
              {currentEvent?.description || "Standby for incoming schedule update"}
            </p>
          </div>
        )}

        {/* Persistent Alert Centre Feed (Controlled by Admin Toggles) */}
        {displayConfig.showAlertCentre && <AlertCentreFeed alerts={recentAlerts} />}
      </div>

      {/* =========================================================================
          4. FOOTER REGION: CONTROLS & SAFE AREA
          ========================================================================= */}
      <footer className="w-full flex items-center justify-between text-gray-500 text-xs font-mono pt-4 border-t border-white/5 z-10">
        <div>
          Department of CSE (Artificial Intelligence and Machine Learning)
        </div>

        <div className="flex items-center gap-4">
          {/* Autoplay Audio Permission Action */}
          {!audioUnlocked && (
            <button
              onClick={unlockAudio}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-green text-black font-black uppercase text-xs tracking-wider shadow-[0_0_15px_rgba(57,255,20,0.4)] hover:bg-neon-green/90 transition-all animate-bounce"
            >
              <span>🔊 ENABLE CENTRAL VOICE</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors uppercase tracking-wider text-[11px]"
          >
            {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}
          </button>
        </div>
      </footer>
    </main>
  );
}
