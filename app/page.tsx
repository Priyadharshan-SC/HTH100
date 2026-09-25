"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EventCountdown, { EventType } from "@/components/EventCountdown";
import JarvisOrb, { JarvisState } from "@/components/JarvisOrb";
import OmnitrixAlertOverlay, { AlertType } from "@/components/OmnitrixAlertOverlay";
import AlertCentreFeed from "@/components/AlertCentreFeed";
import VoiceMessageCentreFeed, { VoiceMessageItem } from "@/components/VoiceMessageCentreFeed";
import JuryPosterShowcase from "@/components/JuryPosterShowcase";
import FeedbackQrCard from "@/components/FeedbackQrCard";
import { getSocket } from "@/lib/socket";
import { getAudioContext } from "@/lib/soundFX";
import { Radio, Volume2, Tv, Wifi, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

export interface DisplayConfig {
  showCountdown: boolean;
  showSchedule: boolean;
  showAlertCentre: boolean;
  showLogo: boolean;
  showJury?: boolean;
  showFeedbackQr?: boolean;
  customAnnouncement?: string;
}

interface ActiveVoiceNote {
  id: string;
  title: string;
  adminName: string;
  targetVenues: string;
  audioData: string;
}

const isSameEvent = (a?: EventType | null, b?: EventType | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.title === b.title &&
    a.status === b.status
  );
};

export default function EndScreen() {
  const [voiceState, setVoiceState] = useState<JarvisState>("STANDBY");
  const [activeVoiceNote, setActiveVoiceNote] = useState<ActiveVoiceNote | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertType[]>([]);
  const [recentVoiceNotes, setRecentVoiceNotes] = useState<VoiceMessageItem[]>([]);
  const [replayPlayingId, setReplayPlayingId] = useState<string | null>(null);
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
    showJury: true,
    showFeedbackQr: true,
    customAnnouncement: "",
  });

  // Periodic Safe Auto-Refresh for User View (5 minutes / 300s default)
  const DEFAULT_REFRESH_INTERVAL = 300;
  const [refreshCountdown, setRefreshCountdown] = useState<number>(DEFAULT_REFRESH_INTERVAL);
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const activeVoiceNoteRef = useRef(activeVoiceNote);
  activeVoiceNoteRef.current = activeVoiceNote;
  const replayPlayingIdRef = useRef(replayPlayingId);
  replayPlayingIdRef.current = replayPlayingId;

  // Auto-refresh timer loop
  useEffect(() => {
    let intervalSec = DEFAULT_REFRESH_INTERVAL;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("refresh");
      if (p && !isNaN(Number(p))) {
        intervalSec = Math.max(30, Number(p));
      }
    }
    setRefreshCountdown(intervalSec);

    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          const isAudioBusy =
            voiceStateRef.current === "SPEAKING" ||
            activeVoiceNoteRef.current !== null ||
            replayPlayingIdRef.current !== null;

          if (isAudioBusy) {
            return 15; // Defer reload if audio is actively playing
          }

          console.log("[HTH] Auto-refreshing user view for memory and schedule sync...");
          window.location.reload();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const replayAudioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const playedVoiceNotesRef = useRef<Set<string>>(new Set());
  const seenAlertIds = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef<boolean>(false);

  // Read Venue and Display identity on initial load & restore played voice notes
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

      // Restore previously played voice notes to prevent any repeating
      try {
        const stored = sessionStorage.getItem("hth_played_voice_notes");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => playedVoiceNotesRef.current.add(id));
          }
        }
      } catch (_) {}
    }
  }, []);

  // Play incoming voice note ONCE with auto-cleanup and visualizer activation
  const playVoiceNote = (note: any) => {
    if (!note || !note.id || !note.audioData) return;
    // Guaranteed Single Play: If already played on this device, do not auto-play again
    if (playedVoiceNotesRef.current.has(note.id)) return;

    // Check venue targeting
    const target = note.targetVenues || "ALL";
    const isTargeted =
      target === "ALL" || target.includes("ALL") || target.includes(venueCode);
    if (!isTargeted) return;

    playedVoiceNotesRef.current.add(note.id);
    try {
      sessionStorage.setItem(
        "hth_played_voice_notes",
        JSON.stringify(Array.from(playedVoiceNotesRef.current))
      );
    } catch (_) {}

    // Cache audioData in memory for on-demand replay
    audioCacheRef.current.set(note.id, note.audioData);

    // Stop any active replay
    if (replayAudioElRef.current) {
      replayAudioElRef.current.pause();
      replayAudioElRef.current.currentTime = 0;
      setReplayPlayingId(null);
    }

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
          if (audioElRef.current) {
            audioElRef.current.pause();
            audioElRef.current.removeAttribute("src");
          }
        }, 1000);
      };
    }
  };

  // Replay a voice note on-demand from the Voice Message Centre
  const handleReplayVoiceNote = async (note: VoiceMessageItem) => {
    try {
      handleStopVoiceNote();

      let audioSrc: string | undefined = audioCacheRef.current.get(note.id);
      if (!audioSrc) {
        // Fetch audio data on-demand from database
        const res = await fetch(`/api/voice/broadcast?id=${note.id}`);
        const data = await res.json();
        if (data?.voiceNote?.audioData && typeof data.voiceNote.audioData === "string") {
          audioSrc = data.voiceNote.audioData;
          audioCacheRef.current.set(note.id, data.voiceNote.audioData);
        }
      }

      if (!audioSrc) return;

      setReplayPlayingId(note.id);
      setVoiceState("SPEAKING");

      if (replayAudioElRef.current) {
        replayAudioElRef.current.src = audioSrc;
        replayAudioElRef.current.currentTime = 0;
        replayAudioElRef.current.play().catch((err) => {
          console.warn("Replay audio error:", err);
        });

        replayAudioElRef.current.onended = () => {
          setReplayPlayingId(null);
          setVoiceState("STANDBY");
          if (replayAudioElRef.current) {
            replayAudioElRef.current.removeAttribute("src");
          }
        };
      }
    } catch (err) {
      console.error("Replay voice note error:", err);
      setReplayPlayingId(null);
      setVoiceState("STANDBY");
    }
  };

  // Stop active replay audio
  const handleStopVoiceNote = () => {
    if (replayAudioElRef.current) {
      replayAudioElRef.current.pause();
      replayAudioElRef.current.removeAttribute("src");
    }
    setReplayPlayingId(null);
    setVoiceState("STANDBY");
  };

  // Resilient HTTP Polling & Database Synchronization (Fail-Safe for Vercel Serverless)
  useEffect(() => {
    let isMounted = true;

    const syncFromDatabase = async () => {
      try {
        const timestamp = Date.now();
        const fetchOptions: RequestInit = {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        };

        // 1. Sync Display Configuration (Toggles, Custom Announcement Ticker)
        fetch(`/api/display-config?_t=${timestamp}`, fetchOptions)
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

        // 2. Sync Event Schedule, Timeline Milestones & Server Time
        fetch(`/api/events/current?_t=${timestamp}`, fetchOptions)
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted) return;
            if (data?.currentEvent !== undefined) {
              setCurrentEvent((prev) => (isSameEvent(prev, data.currentEvent) ? prev : (data.currentEvent ?? null)));
            }
            if (data?.nextEvent !== undefined) {
              setNextEvent((prev) => (isSameEvent(prev, data.nextEvent) ? prev : (data.nextEvent ?? null)));
            }
            if (data?.activeMilestone !== undefined) {
              setActiveMilestone((prev) => (isSameEvent(prev, data.activeMilestone) ? prev : (data.activeMilestone ?? null)));
            }
            if (data?.nextMilestone !== undefined) {
              setNextMilestone((prev) => (isSameEvent(prev, data.nextMilestone) ? prev : (data.nextMilestone ?? null)));
            }
            if (data?.serverTime) {
              const incomingTime = data.serverTime;
              setServerTime((prev) => {
                if (!prev) return incomingTime;
                const prevMs = new Date(prev).getTime();
                const newMs = new Date(incomingTime).getTime();
                if (Math.abs(newMs - prevMs) > 3000) {
                  return incomingTime;
                }
                return prev;
              });
            }
          })
          .catch(() => {});

        // 3. Sync Venues
        fetch(`/api/venues?_t=${timestamp}`, fetchOptions)
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

        // 5. Sync Alerts & Trigger New/Rebroadcasted Alerts Instantly
        fetch(`/api/alerts?_t=${timestamp}`, fetchOptions)
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !data?.alerts || !Array.isArray(data.alerts)) return;

            const allAlerts: AlertType[] = data.alerts;

            // Instantly sync Alert Centre Feed with active alerts (adds new, updates modified, purges deleted)
            setRecentAlerts(allAlerts.slice(0, 10));

            const now = Date.now();
            allAlerts.forEach((alert: any) => {
              // Composite key includes createdAt/updatedAt so rebroadcasted alerts trigger immediately
              const alertKey = `${alert.id}_${alert.createdAt || ""}_${alert.updatedAt || ""}`;
              const eventTimestamp = new Date(alert.updatedAt || alert.createdAt || now).getTime();
              const ageMs = now - eventTimestamp;

              if (!seenAlertIds.current.has(alertKey)) {
                seenAlertIds.current.add(alertKey);

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

                // On first load: trigger if created within the last 45 seconds so recent broadcasts aren't missed
                // On subsequent polling: trigger if created/updated within the last 3 minutes
                const maxAge = initialLoadedRef.current ? 3 * 60 * 1000 : 45 * 1000;
                if (isTargeted && ageMs < maxAge) {
                  // Dispatch to mechanical Omnitrix overlay
                  window.dispatchEvent(new CustomEvent("hth-new-alert", { detail: alert }));
                }
              }
            });

            initialLoadedRef.current = true;
          })
          .catch(() => {});

        // 6. Sync Voice Message List for Voice Message Centre
        fetch(`/api/voice/broadcast?_t=${timestamp}`, fetchOptions)
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !data?.voiceNotes || !Array.isArray(data.voiceNotes)) return;
            setRecentVoiceNotes(data.voiceNotes);
          })
          .catch(() => {});

        // 7. Sync Latest Voice Note for Automatic Single-Play
        fetch(`/api/voice/broadcast?latest=true&_t=${timestamp}`, fetchOptions)
          .then((res) => res.json())
          .then((data) => {
            if (!isMounted || !data?.latest) return;
            if (data.latest.id && data.latest.audioData) {
              audioCacheRef.current.set(data.latest.id, data.latest.audioData);
            }
            playVoiceNote(data.latest);
          })
          .catch(() => {});
      } catch (err) {
        console.error("Resilient sync error:", err);
      }
    };

    // Initial sync immediately on load
    syncFromDatabase();

    // High frequency 1.2-second live sync interval for real-time responsiveness without page refresh
    const interval = setInterval(syncFromDatabase, 1200);

    // Immediate sync on window focus and tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFromDatabase();
      }
    };
    window.addEventListener("focus", syncFromDatabase);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", syncFromDatabase);
      document.removeEventListener("visibilitychange", handleVisibility);
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
      if (data.currentEvent !== undefined) {
        setCurrentEvent((prev) => (isSameEvent(prev, data.currentEvent) ? prev : (data.currentEvent ?? null)));
      }
      if (data.nextEvent !== undefined) {
        setNextEvent((prev) => (isSameEvent(prev, data.nextEvent) ? prev : (data.nextEvent ?? null)));
      }
      if (data.activeMilestone !== undefined) {
        setActiveMilestone((prev) => (isSameEvent(prev, data.activeMilestone) ? prev : (data.activeMilestone ?? null)));
      }
      if (data.nextMilestone !== undefined) {
        setNextMilestone((prev) => (isSameEvent(prev, data.nextMilestone) ? prev : (data.nextMilestone ?? null)));
      }
      if (data.serverTime) {
        const incomingTime = data.serverTime;
        setServerTime((prev) => {
          if (!prev) return incomingTime;
          const prevMs = new Date(prev).getTime();
          const newMs = new Date(incomingTime).getTime();
          if (Math.abs(newMs - prevMs) > 3000) {
            return incomingTime;
          }
          return prev;
        });
      }
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
      if (note?.id) {
        setRecentVoiceNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
        if (note.audioData) {
          audioCacheRef.current.set(note.id, note.audioData);
        }
      }
      playVoiceNote(note);
    };

    socket.on("VOICE_NOTE_BROADCAST", handleVoiceNote);

    // 7. Remote Auto-Refresh Commands from Backend / Admin
    const handleRemoteReload = () => {
      console.log("[HTH] Remote reload requested by admin");
      window.location.reload();
    };

    socket.on("REFRESH_USERS_VIEW", handleRemoteReload);
    socket.on("FORCE_USER_VIEW_RELOAD", handleRemoteReload);
    socket.on("RELOAD_PAGE", handleRemoteReload);

    return () => {
      socket.off("REFRESH_USERS_VIEW", handleRemoteReload);
      socket.off("FORCE_USER_VIEW_RELOAD", handleRemoteReload);
      socket.off("RELOAD_PAGE", handleRemoteReload);
      socket.off("VOICE_NOTE_BROADCAST", handleVoiceNote);
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
    // Only attempt audio element playback if activeVoiceNote is currently active and waiting
    if (activeVoiceNote && audioElRef.current && audioElRef.current.paused) {
      audioElRef.current.muted = false;
      audioElRef.current.volume = 1.0;
      audioElRef.current.play().catch(() => {});
    }
  };

  // Global user interaction listener to automatically unlock audio on first touch/click (runs only once)
  useEffect(() => {
    if (audioUnlocked) return;
    const handleGlobalInteraction = () => {
      unlockAudio();
    };
    window.addEventListener("click", handleGlobalInteraction, { once: true });
    window.addEventListener("touchstart", handleGlobalInteraction, { once: true });
    window.addEventListener("keydown", handleGlobalInteraction, { once: true });
    return () => {
      window.removeEventListener("click", handleGlobalInteraction);
      window.removeEventListener("touchstart", handleGlobalInteraction);
      window.removeEventListener("keydown", handleGlobalInteraction);
    };
  }, [audioUnlocked, activeVoiceNote]);

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

      {/* Dedicated Audio elements for live broadcast and replay (No autoPlay attribute) */}
      <audio
        ref={audioElRef}
        playsInline
        preload="auto"
        className="fixed -top-96 -left-96 opacity-0 pointer-events-none"
      />
      <audio
        ref={replayAudioElRef}
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
          3. CENTER REGION: COUNTDOWN, TELEMETRY & RIGHT-SIDE VERTICAL JURY SHOWCASE
          Visually dominant, scalable from 1080p to 4K without overlapping
          ========================================================================= */}
      <div className="flex-1 w-full max-w-[1720px] mx-auto flex items-center justify-center gap-6 xl:gap-8 my-3 z-10 px-2 sm:px-4">
        {/* Main Center Column (Countdown, Milestones, Dual Feeds) */}
        <div className="flex-1 max-w-5xl flex flex-col items-center justify-center gap-6 w-full">
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

          {/* Dual Command Feed: Persistent Alert Centre & Voice Message Centre (with Replay) */}
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start justify-center">
            {displayConfig.showAlertCentre ? (
              <AlertCentreFeed alerts={recentAlerts} />
            ) : (
              <div className="hidden md:block" />
            )}
            <VoiceMessageCentreFeed
              voiceNotes={recentVoiceNotes}
              activePlayingId={replayPlayingId}
              onPlayNote={handleReplayVoiceNote}
              onStopNote={handleStopVoiceNote}
            />
          </div>

          {/* Mobile / Tablet Viewport (< xl): Gracefully rendered below feeds */}
          {(displayConfig.showFeedbackQr !== false || displayConfig.showJury !== false) && (
            <div className="xl:hidden w-full max-w-xs mx-auto mt-4 flex flex-col gap-4">
              {displayConfig.showFeedbackQr !== false && <FeedbackQrCard />}
              {displayConfig.showJury !== false && <JuryPosterShowcase />}
            </div>
          )}
        </div>

        {/* Right Side: Feedback QR + Vertical Jury Poster Showcase (Docked cleanly on right side for 1080p, 4K & Smart Boards) */}
        {(displayConfig.showFeedbackQr !== false || displayConfig.showJury !== false) && (
          <div className="hidden xl:flex flex-col items-center justify-center shrink-0 w-64 2xl:w-72 gap-4">
            {displayConfig.showFeedbackQr !== false && <FeedbackQrCard />}
            {displayConfig.showJury !== false && <JuryPosterShowcase />}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. FOOTER REGION: CONTROLS & SAFE AREA
          ========================================================================= */}
      <footer className="w-full flex flex-wrap items-center justify-between text-gray-500 text-xs font-mono pt-4 border-t border-white/5 z-10 gap-3">
        <div>
          Department of CSE (Artificial Intelligence and Machine Learning)
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-Refresh Telemetry Badge & Manual Trigger */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-cyan/40 text-[11px] text-gray-300 font-mono transition-all cursor-pointer group shadow-sm"
            title="Click to refresh user view now"
          >
            <RefreshCw className="w-3 h-3 text-neon-cyan group-hover:rotate-180 transition-transform duration-500" />
            <span>
              AUTO-REFRESH:{" "}
              <span className="text-neon-cyan font-bold">
                {Math.floor(refreshCountdown / 60)}:
                {(refreshCountdown % 60).toString().padStart(2, "0")}
              </span>
            </span>
          </button>

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
