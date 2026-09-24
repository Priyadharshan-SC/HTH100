"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export type JarvisState = "STANDBY" | "CONNECTING" | "CONNECTED" | "SPEAKING" | "DISCONNECTED";

interface JarvisOrbProps {
  state?: JarvisState;
  audioStream?: MediaStream | null;
  externalVolume?: number; // 0 to 1, if provided from external WebRTC stats
  size?: "sm" | "md" | "lg" | "xl";
  labelOverride?: string;
  showStatusLabel?: boolean;
}

export default function JarvisOrb({
  state = "STANDBY",
  audioStream = null,
  externalVolume,
  size = "lg",
  labelOverride,
  showStatusLabel = true,
}: JarvisOrbProps) {
  const [amplitude, setAmplitude] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Size dimensions
  const dimensions = {
    sm: { container: "w-28 h-28", core: 40, ring1: 60, ring2: 80, text: "text-xs" },
    md: { container: "w-44 h-44", core: 64, ring1: 96, ring2: 128, text: "text-sm" },
    lg: { container: "w-64 h-64 md:w-72 md:h-72", core: 96, ring1: 150, ring2: 200, text: "text-base" },
    xl: { container: "w-80 h-80 md:w-96 md:h-96", core: 120, ring1: 190, ring2: 260, text: "text-lg" },
  }[size];

  // Analyze audio stream for amplitude
  useEffect(() => {
    if (!audioStream || state !== "SPEAKING") {
      setAmplitude(0);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(audioStream);
      sourceRef.current = source;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, Math.max(0, avg / 128));

        setAmplitude(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn("Jarvis audio analyser init error:", err);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [audioStream, state]);

  // Use external volume if provided and higher
  const activeAmp = externalVolume !== undefined ? Math.max(amplitude, externalVolume) : amplitude;

  // Derive visual status text and colors
  let statusText = "JARVIS STANDBY";
  let themeColor = "border-neon-green text-neon-green";
  let glowColor = "rgba(57, 255, 20, 0.4)";

  switch (state) {
    case "CONNECTING":
      statusText = "CONNECTING TO CENTRAL VOICE";
      themeColor = "border-yellow-400 text-yellow-400";
      glowColor = "rgba(250, 204, 21, 0.4)";
      break;
    case "CONNECTED":
      statusText = "CENTRAL VOICE READY";
      themeColor = "border-neon-cyan text-neon-cyan";
      glowColor = "rgba(0, 243, 255, 0.5)";
      break;
    case "SPEAKING":
      statusText = "CENTRAL VOICE LIVE";
      themeColor = "border-neon-green text-neon-green";
      glowColor = `rgba(57, 255, 20, ${0.4 + activeAmp * 0.6})`;
      break;
    case "DISCONNECTED":
      statusText = "VOICE CONNECTION LOST";
      themeColor = "border-red-500 text-red-500";
      glowColor = "rgba(239, 68, 68, 0.3)";
      break;
    case "STANDBY":
    default:
      statusText = "JARVIS STANDBY";
      themeColor = "border-emerald-500/60 text-emerald-400/80";
      glowColor = "rgba(16, 185, 129, 0.25)";
      break;
  }

  if (labelOverride) {
    statusText = labelOverride;
  }

  // Reactive scale calculations based on live amplitude
  const coreScale = state === "SPEAKING" ? 1 + activeAmp * 0.45 : 1;
  const ringScale = state === "SPEAKING" ? 1 + activeAmp * 0.25 : 1;
  const pulseSpeed = state === "SPEAKING" ? 0.3 : state === "CONNECTING" ? 1 : 3.5;

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* JARVIS Circular Interface */}
      <div className={`relative flex items-center justify-center ${dimensions.container}`}>
        {/* Background Ambient Glow */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{
            scale: state === "SPEAKING" ? [1, 1.25 + activeAmp * 0.5, 1] : [1, 1.08, 1],
            opacity: state === "DISCONNECTED" ? 0.15 : state === "SPEAKING" ? 0.5 + activeAmp * 0.5 : 0.35,
          }}
          transition={{
            repeat: Infinity,
            duration: pulseSpeed,
            ease: "easeInOut",
          }}
          style={{
            width: dimensions.ring2 * 1.3,
            height: dimensions.ring2 * 1.3,
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* Outer Tech Ring (Counter-clockwise rotation) */}
        <motion.div
          className="absolute rounded-full border border-dashed pointer-events-none"
          animate={{
            rotate: state === "CONNECTING" ? -360 : state === "SPEAKING" ? -360 : -360,
            scale: ringScale,
          }}
          transition={{
            rotate: { repeat: Infinity, duration: state === "SPEAKING" ? 8 : 25, ease: "linear" },
            scale: { duration: 0.1 },
          }}
          style={{
            width: dimensions.ring2,
            height: dimensions.ring2,
            borderColor: state === "SPEAKING" ? "#39ff14" : state === "CONNECTED" ? "#00f3ff" : "rgba(255,255,255,0.15)",
            borderWidth: "1.5px",
          }}
        />

        {/* Energy Segment Ring (Clockwise rotation) */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{
            rotate: 360,
            scale: ringScale * 0.95,
          }}
          transition={{
            rotate: { repeat: Infinity, duration: state === "SPEAKING" ? 4 : 16, ease: "linear" },
            scale: { duration: 0.1 },
          }}
          style={{
            width: dimensions.ring1,
            height: dimensions.ring1,
            border: "2px solid transparent",
            borderTopColor: state === "SPEAKING" ? "#39ff14" : state === "CONNECTED" ? "#00f3ff" : "rgba(57, 255, 20, 0.4)",
            borderBottomColor: state === "SPEAKING" ? "#39ff14" : state === "CONNECTED" ? "#00f3ff" : "rgba(57, 255, 20, 0.4)",
          }}
        />

        {/* Real-time Waveform Ripple Ring (Active when speaking) */}
        {state === "SPEAKING" && (
          <motion.div
            className="absolute rounded-full border-2 border-neon-green/60 pointer-events-none"
            animate={{
              scale: [1, 1.45 + activeAmp * 0.7],
              opacity: [0.8, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 0.8,
              ease: "easeOut",
            }}
            style={{
              width: dimensions.core * 1.1,
              height: dimensions.core * 1.1,
            }}
          />
        )}

        {/* Central Core Orb */}
        <motion.div
          className="relative rounded-full flex items-center justify-center backdrop-blur-md shadow-2xl z-10"
          animate={{
            scale: coreScale,
          }}
          transition={{
            duration: 0.08,
            ease: "easeOut",
          }}
          style={{
            width: dimensions.core,
            height: dimensions.core,
            background:
              state === "DISCONNECTED"
                ? "radial-gradient(circle, #331111 0%, #0a0a0a 90%)"
                : state === "SPEAKING"
                ? "radial-gradient(circle, #39ff14 0%, #052e16 70%, #000 100%)"
                : state === "CONNECTED"
                ? "radial-gradient(circle, #00f3ff 0%, #083344 70%, #000 100%)"
                : "radial-gradient(circle, #10b981 0%, #064e3b 70%, #000 100%)",
            boxShadow: `0 0 ${20 + activeAmp * 40}px ${glowColor}`,
            border: `2px solid ${state === "SPEAKING" ? "#39ff14" : state === "CONNECTED" ? "#00f3ff" : "rgba(255,255,255,0.2)"}`,
          }}
        >
          {/* Inner Core Iris / Aperture */}
          <div className="w-1/3 h-1/3 rounded-full bg-white/90 shadow-[0_0_10px_#fff]" />

          {/* Core Sci-Fi Crosshairs */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-full h-[1px] bg-white/40" />
            <div className="absolute h-full w-[1px] bg-white/40" />
          </div>
        </motion.div>
      </div>

      {/* Futuristic Status Badge */}
      {showStatusLabel && (
        <div className="mt-4 flex flex-col items-center">
          <div
            className={`flex items-center gap-2 px-4 py-1 rounded-full bg-black/70 border backdrop-blur-md ${themeColor} shadow-lg`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                state === "SPEAKING"
                  ? "bg-neon-green animate-ping"
                  : state === "CONNECTING"
                  ? "bg-yellow-400 animate-pulse"
                  : state === "CONNECTED"
                  ? "bg-neon-cyan"
                  : state === "DISCONNECTED"
                  ? "bg-red-500"
                  : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className={`font-mono font-bold tracking-[0.25em] uppercase text-xs`}>
              {statusText}
            </span>
          </div>

          {/* Micro amplitude bar when live */}
          {state === "SPEAKING" && (
            <div className="w-32 h-1 bg-white/10 rounded-full mt-2 overflow-hidden flex items-center">
              <motion.div
                className="h-full bg-neon-green rounded-full shadow-[0_0_8px_#39ff14]"
                style={{ width: `${Math.round(activeAmp * 100)}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
