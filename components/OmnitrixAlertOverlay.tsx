"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket";
import { playAlertActivationSound, isSoundEnabled, setSoundEnabled, getAudioContext } from "@/lib/soundFX";

export type AlertType = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "URGENT";
  priority: "NORMAL" | "HIGH";
  duration: number; // in seconds (default 15)
  createdAt: string;
  imageUrl?: string | null;
};

interface OmnitrixAlertOverlayProps {
  onAlertFinished?: (alert: AlertType) => void;
  previewAlert?: AlertType | null;
  onPreviewClose?: () => void;
}

export default function OmnitrixAlertOverlay({
  onAlertFinished,
  previewAlert,
  onPreviewClose,
}: OmnitrixAlertOverlayProps) {
  const [alertQueue, setAlertQueue] = useState<AlertType[]>([]);
  const [currentAlert, setCurrentAlert] = useState<AlertType | null>(null);
  const [animPhase, setAnimPhase] = useState<"IDLE" | "DETECT" | "BUILDUP" | "SNAP" | "REVEAL" | "DISPLAY" | "COLLAPSE">("IDLE");
  const [soundOn, setSoundOn] = useState<boolean>(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal sound state
  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      playAlertActivationSound("NORMAL");
    }
  };

  // Handle incoming socket alerts
  useEffect(() => {
    const socket = getSocket();

    const handleNewAlert = (incoming: any) => {
      const alert = incoming.alert || incoming;
      setAlertQueue((prev) => {
        // Prevent duplicate IDs
        if (prev.some((a) => a.id === alert.id) || currentAlert?.id === alert.id) return prev;
        // Priority queuing: URGENT / HIGH priority goes to front
        if (alert.priority === "HIGH" || alert.type === "URGENT") {
          return [alert, ...prev];
        }
        return [...prev, alert];
      });
    };

    socket.on("new-alert", handleNewAlert);
    socket.on("ALERT_BROADCASTED", handleNewAlert);

    // Also support resilient local/polling events
    const handleCustom = (e: any) => {
      if (e?.detail) handleNewAlert(e.detail);
    };
    window.addEventListener("hth-new-alert", handleCustom);

    return () => {
      socket.off("new-alert", handleNewAlert);
      socket.off("ALERT_BROADCASTED", handleNewAlert);
      window.removeEventListener("hth-new-alert", handleCustom);
    };
  }, [currentAlert]);

  // Handle preview alert from Admin modal
  useEffect(() => {
    if (previewAlert) {
      setCurrentAlert(previewAlert);
      setAnimPhase("DETECT");
    }
  }, [previewAlert]);

  // Alert queue processing pipeline
  useEffect(() => {
    if (!currentAlert && alertQueue.length > 0) {
      const nextAlert = alertQueue[0];
      setAlertQueue((prev) => prev.slice(1));
      setCurrentAlert(nextAlert);
      setAnimPhase("DETECT");
    }
  }, [currentAlert, alertQueue]);

  // Orchestrate the circular mechanical activation sequence
  useEffect(() => {
    if (!currentAlert) return;

    if (animPhase === "DETECT") {
      // Phase 1: Detection signal (0 - 300ms)
      playAlertActivationSound(currentAlert.priority);
      const t1 = setTimeout(() => {
        setAnimPhase("BUILDUP");
      }, 300);
      return () => clearTimeout(t1);
    }

    if (animPhase === "BUILDUP") {
      // Phase 2: Ring spin & energy buildup (300ms - 800ms)
      const t2 = setTimeout(() => {
        setAnimPhase("SNAP");
      }, 500);
      return () => clearTimeout(t2);
    }

    if (animPhase === "SNAP") {
      // Phase 3: Mechanical Lock / Snap impact (800ms - 1000ms)
      const t3 = setTimeout(() => {
        setAnimPhase("REVEAL");
      }, 200);
      return () => clearTimeout(t3);
    }

    if (animPhase === "REVEAL") {
      // Phase 4: Expansion to alert card (1000ms - 1200ms)
      const t4 = setTimeout(() => {
        setAnimPhase("DISPLAY");
      }, 250);
      return () => clearTimeout(t4);
    }

    if (animPhase === "DISPLAY") {
      // Phase 5: Display for alert.duration (default 15s)
      const durationMs = (currentAlert.duration || 15) * 1000;
      timerRef.current = setTimeout(() => {
        setAnimPhase("COLLAPSE");
      }, durationMs);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    if (animPhase === "COLLAPSE") {
      // Phase 6: Circular energy collapse into standby (0.4s)
      const t6 = setTimeout(() => {
        if (onAlertFinished && currentAlert) {
          onAlertFinished(currentAlert);
        }
        if (onPreviewClose) {
          onPreviewClose();
        }
        setCurrentAlert(null);
        setAnimPhase("IDLE");
      }, 400);
      return () => clearTimeout(t6);
    }
  }, [animPhase, currentAlert, onAlertFinished, onPreviewClose]);

  // Color mappings
  const getBadgeColors = (type: string) => {
    switch (type) {
      case "URGENT":
        return {
          border: "border-red-500",
          text: "text-red-400",
          glow: "rgba(239, 68, 68, 0.6)",
          bg: "from-red-950/80 via-black/90 to-red-950/60",
          ringColor: "#ef4444",
        };
      case "WARNING":
        return {
          border: "border-yellow-400",
          text: "text-yellow-400",
          glow: "rgba(250, 204, 21, 0.6)",
          bg: "from-yellow-950/80 via-black/90 to-yellow-950/60",
          ringColor: "#facc15",
        };
      case "SUCCESS":
        return {
          border: "border-neon-green",
          text: "text-neon-green",
          glow: "rgba(57, 255, 20, 0.6)",
          bg: "from-emerald-950/80 via-black/90 to-emerald-950/60",
          ringColor: "#39ff14",
        };
      case "INFO":
      default:
        return {
          border: "border-neon-cyan",
          text: "text-neon-cyan",
          glow: "rgba(0, 243, 255, 0.6)",
          bg: "from-cyan-950/80 via-black/90 to-cyan-950/60",
          ringColor: "#00f3ff",
        };
    }
  };

  const styleConfig = currentAlert ? getBadgeColors(currentAlert.type) : getBadgeColors("INFO");

  return (
    <>
      {/* Sound Toggle (Subtle, top-right or bottom-right of screen) */}
      <button
        onClick={toggleSound}
        className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 border border-white/20 text-xs font-mono text-gray-300 hover:text-white backdrop-blur-md transition-all shadow-lg"
        title="Toggle Alert Sounds"
      >
        <span>{soundOn ? "🔊 SOUND ON" : "🔇 SOUND OFF"}</span>
      </button>

      {/* Main Omnitrix Sci-Fi Alert Modal / Overlay */}
      <AnimatePresence>
        {currentAlert && animPhase !== "IDLE" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md pointer-events-auto">
            {/* Ambient Pulse Glow */}
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${styleConfig.glow} 0%, rgba(0,0,0,0) 70%)`,
              }}
              animate={{
                scale: animPhase === "SNAP" ? [1, 1.3, 1] : [1, 1.1, 1],
                opacity: animPhase === "COLLAPSE" ? 0 : [0.3, 0.6, 0.3],
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />

            {/* PHASES 1 to 3: The Circular Mechanical Mechanism */}
            {(animPhase === "DETECT" || animPhase === "BUILDUP" || animPhase === "SNAP") && (
              <motion.div
                className="relative flex items-center justify-center w-72 h-72 md:w-80 md:h-80"
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Concentric Mechanical Tech Ring 1 (Rapid Clockwise spin in Buildup) */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-dashed pointer-events-none"
                  animate={{
                    rotate: animPhase === "BUILDUP" ? 720 : animPhase === "SNAP" ? 720 : 0,
                    scale: animPhase === "SNAP" ? 1.08 : 1,
                  }}
                  transition={{
                    rotate: { duration: 0.5, ease: "easeInOut" },
                    scale: { duration: 0.15 },
                  }}
                  style={{
                    borderColor: styleConfig.ringColor,
                  }}
                />

                {/* Concentric Mechanical Ring 2 (Rapid Counter-Clockwise spin) */}
                <motion.div
                  className="absolute inset-4 rounded-full border-2 pointer-events-none"
                  animate={{
                    rotate: animPhase === "BUILDUP" ? -540 : animPhase === "SNAP" ? -540 : 0,
                  }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    borderTopColor: styleConfig.ringColor,
                    borderBottomColor: styleConfig.ringColor,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                  }}
                />

                {/* Energy Ticks around the circle */}
                <div className="absolute inset-8 rounded-full border border-white/20 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-white/40 absolute" />
                  <div className="h-full w-[1px] bg-white/40 absolute" />
                </div>

                {/* Central Sci-Fi Energy Core */}
                <motion.div
                  className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl backdrop-blur-lg border-2 z-10"
                  animate={{
                    scale: animPhase === "SNAP" ? [1, 1.25, 1.1] : 1,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    borderColor: styleConfig.ringColor,
                    background: `radial-gradient(circle, ${styleConfig.ringColor} 0%, #050505 85%)`,
                    boxShadow: `0 0 35px ${styleConfig.glow}`,
                  }}
                >
                  <span className="font-mono text-[10px] tracking-widest font-black uppercase text-black bg-white px-2 py-0.5 rounded-full mb-1">
                    {animPhase === "DETECT" ? "DETECT" : animPhase === "BUILDUP" ? "SYNC" : "LOCKED"}
                  </span>
                  <span className="text-white font-black text-xs tracking-wider">
                    BROADCAST
                  </span>
                </motion.div>
              </motion.div>
            )}

            {/* PHASES 4 & 5: The Expanded Dramatic Alert Card */}
            {(animPhase === "REVEAL" || animPhase === "DISPLAY") && (
              <motion.div
                initial={{ scale: 0.3, opacity: 0, filter: "blur(12px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.8, opacity: 0, filter: "blur(16px)" }}
                transition={{ duration: 0.35, type: "spring", bounce: 0.25 }}
                className={`relative max-w-2xl max-h-[88vh] overflow-y-auto w-full rounded-2xl border-2 p-8 md:p-10 shadow-2xl bg-gradient-to-b ${styleConfig.bg} backdrop-blur-2xl text-center ${styleConfig.border}`}
                style={{
                  boxShadow: `0 0 45px ${styleConfig.glow}`,
                }}
              >
                {/* Futuristic Scanlines Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

                {/* Top Sci-Fi Header Tag & Dismiss Button */}
                <button
                  onClick={() => setAnimPhase("COLLAPSE")}
                  className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white bg-black/40 hover:bg-white/20 px-3 py-1 rounded-full border border-white/10 transition-all text-xs font-mono tracking-wider uppercase cursor-pointer"
                  title="Dismiss alert"
                >
                  ✕ Dismiss
                </button>

                <div className="flex items-center justify-center gap-3 mb-6 relative z-10">
                  <div
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/80 border ${styleConfig.border} ${styleConfig.text} font-mono font-black text-xs tracking-[0.25em] uppercase shadow-lg`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-current animate-ping" />
                    <span>COMMAND ALERT // {currentAlert.type}</span>
                  </div>
                </div>

                {/* Alert Title */}
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-wider text-white mb-5 relative z-10 drop-shadow-[0_2px_15px_rgba(255,255,255,0.3)]">
                  {currentAlert.title}
                </h2>

                {/* Optional Alert Photo */}
                {currentAlert.imageUrl && (
                  <div className="relative z-10 my-5 max-w-md mx-auto rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black/60 p-1">
                    <img
                      src={currentAlert.imageUrl}
                      alt={currentAlert.title}
                      className="max-h-56 sm:max-h-64 w-full object-contain rounded-lg mx-auto"
                    />
                  </div>
                )}

                {/* Alert Message */}
                <p className="text-xl md:text-2xl font-medium text-gray-100 max-w-xl mx-auto leading-relaxed relative z-10 drop-shadow">
                  {currentAlert.message}
                </p>

                {/* 15-second Countdown Indicator Bar */}
                <div className="relative mt-8 w-full bg-white/10 h-1.5 rounded-full overflow-hidden z-10">
                  <motion.div
                    className="h-full bg-white shadow-[0_0_10px_#fff]"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{
                      duration: currentAlert.duration || 15,
                      ease: "linear",
                    }}
                  />
                </div>

                {/* Footer Timestamp & Dismiss Info */}
                <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-gray-400 relative z-10">
                  <span>CENTRAL COMMAND BROADCAST</span>
                  <span>{new Date(currentAlert.createdAt).toLocaleTimeString()}</span>
                </div>
              </motion.div>
            )}

            {/* PHASE 6: Collapse back into core */}
            {animPhase === "COLLAPSE" && (
              <motion.div
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 0.1, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="w-48 h-48 rounded-full border-4 flex items-center justify-center"
                style={{
                  borderColor: styleConfig.ringColor,
                  background: styleConfig.ringColor,
                  boxShadow: `0 0 50px ${styleConfig.glow}`,
                }}
              />
            )}
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
