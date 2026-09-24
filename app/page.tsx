"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EventCountdown, { EventType } from "@/components/EventCountdown";
import JarvisOrb, { JarvisState } from "@/components/JarvisOrb";
import OmnitrixAlertOverlay, { AlertType } from "@/components/OmnitrixAlertOverlay";
import AlertCentreFeed from "@/components/AlertCentreFeed";
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

interface ActiveVoiceNote {
  id: string;
  title: string;
  adminName: string;
  targetVenues: string;
  audioData: string;
}

export default function EndScreen() {
  const [voiceState, setVoiceState] = useState<JarvisState>("STANDBY");
  const [activeVoiceNote, setActiveVoiceNote] = useState<ActiveVoiceNote | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<"CONNECTED" | "RECONNECTING" | "OFFLINE">("CONNECTED");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Authoritative event state from server
  const [currentEvent, setCurrentEvent] = useState<EventType | null>(null);
  const [nextEvent, setNextEvent] = useState<EventType | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<EventType | null>(null);
  const [nextMilestone, setNextMilestone] = useState<EventType | null>(null);
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
  const playedVoiceNotesRef = useRef<Set<string>>(new Set());
  const seenAlertIds = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef<boolean>(false);

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

  // Play incoming voice note with auto-cleanup and visualizer activation
  const playVoiceNote = (note: any) => {
    if (!note || !note.id || !note.audioData) return;
    if (playedVoiceNotesRef.current.has(note.id)) return;

    // Check venue targeting
    const target = note.targetVenues || "ALL";
    const isTargeted =
      target === "ALL" || target.includes("ALL") || target.includes(venueCode);
    if (!isTargeted) return;

    playedVoiceNotesRef.current.add(note.id);
    setActiveVoiceNote(note);
    setVoiceState("SPEAKING");

    if (audioElRef.current) {
      audioElRef.current.src = note.audioData;
      audioElRef.current.currentTime = 0;
      audioElRef.current
        .play()
        .then(() => {
          setAudioUnlocked(true);
        })
        .catch((err) => {
          console.warn("Autoplay audio blocked by browser:", err);
          setAudioUnlocked(false);
        });

      audioElRef.current.onended = () => {
        setTimeout(() => {
          setActiveVoiceNote(null);
          setVoiceState("STANDBY");
        }, 1200);
      };
    }
  };

  // Resilient HTTP Polling & Database Synchronization (Fail-Safe for Vercel Serverless)
  useEffect(() => {
    let isMounted = true;

    const syncFromDatabase = async () => {
      try {
        // 1. Sync Display Configuration
        fetch("/api/display-config")
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted) return;
            if (data?.config) {
              setDisplayConfig((prev) => {
                if (JSON.stringify(prev) !== JSON.stringify(data.config)) {
                  return data.config;
                }
                return prev;
              });
            }
          })
          .catch(() => {});

        // 2. Sync Event Schedule & Server Time
        fetch("/api/events/current")
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted) return;
            if (data?.currentEvent !== undefined) setCurrentEvent(data.currentEvent);
            if (data?.nextEvent !== undefined) setNextEvent(data.nextEvent);
            if (data?.activeMilestone !== undefined) setActiveMilestone(data.activeMilestone);
            if (data?.nextMilestone !== undefined) setNextMilestone(data.nextMilestone);
            if (data?.serverTime) setServerTime(data.serverTime);
          })
          .catch(() => {});

        // 3. Sync Venues
        fetch("/api/venues")
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted) return;
            if (data?.venues && Array.isArray(data.venues)) {
              const currentVenue = data.venues.find((v: any) => v.venueCode === venueCode);
              if (currentVenue) {
                if (currentVenue.venueName) setVenueName(currentVenue.venueName);
                if (currentVenue.trackName) setTrackName(currentVenue.trackName);
              }
            }
          })
          .catch(() => {});

        // 4. Send Venue Heartbeat Ping
        fetch("/api/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueCode, displayId, status: "ONLINE" }),
        })
          .then(() => {
            if (isMounted) setConnectionStatus("CONNECTED");
          })
          .catch(() => {});

        // 5. Sync Alerts & Trigger New Alerts
        fetch("/api/alerts")
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !data?.alerts || !Array.isArray(data.alerts)) return;

            const allAlerts: AlertType[] = data.alerts;

            // On very first load, seed seenAlertIds and populate alert centre with history
            if (!initialLoadedRef.current) {
              allAlerts.forEach((a) => seenAlertIds.current.add(a.id));
              setRecentAlerts(allAlerts.slice(0, 10));
              initialLoadedRef.current = true;
              return;
            }

            // Keep recentAlerts in sync with active database alerts (purges deleted alerts automatically)
            setRecentAlerts((prev) => {
              const activeIds = new Set(allAlerts.map((a) => a.id));
              const updated = prev.filter((a) => activeIds.has(a.id));
              return updated.length !== prev.length ? updated : prev;
            });

            // On subsequent polls, check for new alerts targeted to this venue
            allAlerts.forEach((alert: any) => {
              if (!seenAlertIds.current.has(alert.id)) {
                seenAlertIds.current.add(alert.id);

                // Check venue targeting
                const isTargeted =
                  !alert.targetType ||
                  alert.targetType === "ALL" ||
                  (alert.targetType === "VENUE" &&
                    alert.targetVenues &&
                    alert.targetVenues.includes(venueCode)) ||
                  (alert.targetType === "DISPLAY" &&
                    alert.targetDisplay &&
                    alert.targetDisplay.includes(displayId));

                // Check recency (created within last 3 minutes)
                const ageMs = Date.now() - new Date(alert.createdAt).getTime();
                if (isTargeted && ageMs < 3 * 60 * 1000) {
                  // Dispatch to mechanical Omnitrix overlay
                  window.dispatchEvent(new CustomEvent("hth-new-alert", { detail: alert }));
                }
              }
            });
          })
          .catch(() => {});

        // 6. Sync Latest Voice Note (HTTP Fallback for Vercel)
        fetch("/api/voice/broadcast?latest=true")
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !data?.latest) return;
            playVoiceNote(data.latest);
          })
          .catch(() => {});
      } catch (err) {
        console.error("Resilient sync error:", err);
      }
    };

    // Initial sync immediately on load
    syncFromDatabase();

    // High frequency 3-second live sync interval for real-time responsiveness on Vercel
    const interval = setInterval(syncFromDatabase, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [venueCode, displayId]);

  // Initialize Socket.io and Real-time Event Listeners
  useEffect(() => {
    const socket = getSocket();

    // 1. Initial State Sync Handler
    const handleStateSync = (data: {
      currentEvent?: EventType | null;
      nextEvent?: EventType | null;
      activeMilestone?: EventType | null;
      nextMilestone?: EventType | null;
      serverTime?: string;
      recentAlerts?: AlertType[];
      voiceSession?: { active: boolean; isMuted: boolean };
      venues?: any[];
      displayConfig?: DisplayConfig;
    }) => {
      if (data.currentEvent !== undefined) setCurrentEvent(data.currentEvent);
      if (data.nextEvent !== undefined) setNextEvent(data.nextEvent);
      if (data.activeMilestone !== undefined) setActiveMilestone(data.activeMilestone);
      if (data.nextMilestone !== undefined) setNextMilestone(data.nextMilestone);
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

    // 6. Voice Note Broadcast Listener
    const handleVoiceNote = (note: any) => {
      playVoiceNote(note);
    };

    socket.on("VOICE_NOTE_BROADCAST", handleVoiceNote);
    socket.on("voice-note-broadcast", handleVoiceNote);

    return () => {
      socket.off("VOICE_NOTE_BROADCAST", handleVoiceNote);
      socket.off("voice-note-broadcast", handleVoiceNote);
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
      {activeVoiceNote && !audioUnlocked && (
        <div
          onClick={unlockAudio}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full bg-red-600 text-white font-mono font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_40px_rgba(239,68,68,0.9)] cursor-pointer animate-bounce flex items-center gap-3 border-2 border-white hover:bg-red-500 transition-all"
        >
          <Volume2 className="w-5 h-5 animate-pulse" />
          <span>🔊 VOICE ANNOUNCEMENT RECEIVED — CLICK ANYWHERE TO PLAY AUDIO</span>
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

        {/* Top-Right Branding */}
        <div className="flex items-center gap-3">
          <img
            src="/cis.png"
            alt="IEEE CIS Logo"
            className="h-8 sm:h-10 md:h-12 w-auto object-contain hidden md:block drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          />
        </div>
      </header>

      {/* =========================================================================
          2. CENTRAL VOICE (JARVIS) DYNAMIC MODAL / OVERLAY
          Smoothly appears when a Voice Note is active
          ========================================================================= */}
      <AnimatePresence>
        {activeVoiceNote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center justify-center p-10 md:p-16 rounded-3xl bg-black/90 border-2 border-neon-green/60 shadow-[0_0_80px_rgba(57,255,20,0.4)] max-w-2xl w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-green" />

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-green/20 border border-neon-green text-neon-green font-mono font-bold text-xs uppercase mb-8 animate-pulse">
                <Volume2 className="w-4 h-4" />
                <span>
                  VOICE ANNOUNCEMENT //{" "}
                  {activeVoiceNote.targetVenues === "ALL"
                    ? "ALL 13 VENUES"
                    : activeVoiceNote.targetVenues}
                </span>
              </div>

              {/* JARVIS Amplitude Reactive Orb */}
              <JarvisOrb
                state="SPEAKING"
                size="xl"
                labelOverride="VOICE ANNOUNCEMENT"
              />

              <div className="mt-8 flex flex-col items-center gap-2">
                <h3 className="text-xl font-black text-white uppercase tracking-wider font-mono">
                  {activeVoiceNote.title || "ANNOUNCEMENT FROM CONTROL CENTRE"}
                </h3>
                <p className="text-xs font-mono text-gray-400">
                  Broadcast by {activeVoiceNote.adminName || "Organizer"}
                </p>
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
        {/* Live Admin Announcement Ticker (If Configured) */}
        {displayConfig.customAnnouncement && displayConfig.customAnnouncement.trim() && (
          <div className="w-full max-w-4xl px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan font-mono text-xs text-center uppercase tracking-wider animate-pulse">
            📢 {displayConfig.customAnnouncement}
          </div>
        )}

        {/* Timeline Event Details Badge Above Timer (With comfortable padding) */}
        {activeMilestone ? (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-6 py-2.5 rounded-full bg-black/70 border border-neon-cyan/40 backdrop-blur-xl shadow-[0_0_25px_rgba(0,243,255,0.25)] text-xs md:text-sm font-mono tracking-wider animate-pulse mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_#39ff14]" />
            <span className="text-gray-400 uppercase text-[10px] font-bold">TIMELINE PHASE:</span>
            <span className="text-neon-cyan font-black uppercase tracking-wide">
              {activeMilestone.title}
            </span>
            <span className="text-gray-500 hidden sm:inline">•</span>
            <span className="text-gray-300 font-bold">
              {new Date(activeMilestone.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(activeMilestone.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {nextMilestone && (
              <>
                <span className="text-gray-600 hidden md:inline">//</span>
                <span className="text-gray-400 hidden md:inline text-[11px]">
                  NEXT: <span className="text-white font-bold">{nextMilestone.title}</span> ({new Date(nextMilestone.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              </>
            )}
          </div>
        ) : nextMilestone ? (
          <div className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-xl text-xs md:text-sm font-mono tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-neon-cyan animate-ping" />
            <span className="text-gray-400 uppercase text-[10px]">NEXT EVENT:</span>
            <span className="text-white font-bold uppercase">{nextMilestone.title}</span>
            <span className="text-neon-cyan">
              at {new Date(nextMilestone.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : null}

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
