"use client";

import { useEffect, useState, useRef } from "react";
import { getSocket } from "@/lib/socket";

export type EventType = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  priority?: number;
};

interface EventCountdownProps {
  initialCurrentEvent?: EventType | null;
  initialNextEvent?: EventType | null;
  initialServerTime?: string | null;
}

export default function EventCountdown({
  initialCurrentEvent = null,
  initialNextEvent = null,
  initialServerTime = null,
}: EventCountdownProps) {
  const [currentEvent, setCurrentEvent] = useState<EventType | null>(initialCurrentEvent);
  const [nextEvent, setNextEvent] = useState<EventType | null>(initialNextEvent);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(() => {
    return initialServerTime ? new Date(initialServerTime).getTime() - Date.now() : 0;
  });
  const [timeLeft, setTimeLeft] = useState<{ hours: string; minutes: string; seconds: string } | null>(null);

  const offsetRef = useRef(serverTimeOffset);
  offsetRef.current = serverTimeOffset;

  // Listen for socket events and initial state
  useEffect(() => {
    const socket = getSocket();

    const fetchCurrent = () => {
      fetch("/api/events/current")
        .then((res) => res.json())
        .then(applyState)
        .catch(() => {});
    };

    const applyState = (data?: {
      currentEvent?: EventType | null;
      nextEvent?: EventType | null;
      serverTime?: string;
    }) => {
      if (!data) {
        fetchCurrent();
        return;
      }
      if (data.currentEvent !== undefined) setCurrentEvent(data.currentEvent);
      if (data.nextEvent !== undefined) setNextEvent(data.nextEvent);
      if (data.serverTime) {
        const offset = new Date(data.serverTime).getTime() - Date.now();
        setServerTimeOffset(offset);
      }
    };

    // If initial data wasn't provided, fetch once
    if (!initialCurrentEvent && !initialNextEvent && !initialServerTime) {
      fetchCurrent();
    }

    socket.on("events-updated", applyState);
    socket.on("EVENT_UPDATED", applyState);
    socket.on("EVENT_DELETED", fetchCurrent);
    socket.on("SCHEDULE_UPDATED", applyState);
    socket.on("SERVER_STATE_SYNC", applyState);

    return () => {
      socket.off("events-updated", applyState);
      socket.off("EVENT_UPDATED", applyState);
      socket.off("EVENT_DELETED", fetchCurrent);
      socket.off("SCHEDULE_UPDATED", applyState);
      socket.off("SERVER_STATE_SYNC", applyState);
    };
  }, [initialCurrentEvent, initialNextEvent, initialServerTime]);

  // Local ticker using authoritative server time offset
  useEffect(() => {
    if (!currentEvent && !nextEvent) {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const now = Date.now() + offsetRef.current;
      let targetTime = 0;

      if (currentEvent && !currentEvent.title.toLowerCase().includes("registration")) {
        targetTime = new Date(currentEvent.endTime).getTime();
      } else if (nextEvent) {
        targetTime = new Date(nextEvent.startTime).getTime();
      } else if (currentEvent) {
        targetTime = new Date(currentEvent.endTime).getTime();
      }

      const diff = targetTime - now;

      if (diff <= 0) {
        // Countdown reached zero, request server sync
        const socket = getSocket();
        socket.emit("REQUEST_CURRENT_STATE");
        setTimeLeft({ hours: "00", minutes: "00", seconds: "00" });
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft({
        hours: h.toString().padStart(2, "0"),
        minutes: m.toString().padStart(2, "0"),
        seconds: s.toString().padStart(2, "0"),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [currentEvent, nextEvent]);

  if (!currentEvent && !nextEvent) {
    return (
      <div className="text-gray-500 font-mono text-sm tracking-widest uppercase italic py-8">
        System Standby • No active schedule
      </div>
    );
  }

  const isCurrentActive = currentEvent && !currentEvent.title.toLowerCase().includes("registration");
  const displayEvent = isCurrentActive ? currentEvent : nextEvent;

  return (
    <div className="flex flex-col items-center justify-center w-full select-none">
      {/* Massive Centered Primary Countdown Container */}
      <div className="flex flex-col items-center justify-center w-full max-w-5xl py-8 md:py-12 px-6 md:px-16 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Futuristic Subtle Background Scanline / Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Phase Header Tag */}
        <div className="mb-4 md:mb-6 flex items-center gap-3">
          {isCurrentActive ? (
            <div className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/40 text-neon-green font-mono font-black text-xs md:text-sm tracking-[0.3em] uppercase shadow-[0_0_15px_rgba(57,255,20,0.3)]">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse" />
              <span>CURRENT EVENT IN PROGRESS</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan font-mono font-black text-xs md:text-sm tracking-[0.35em] uppercase shadow-[0_0_20px_rgba(0,243,255,0.3)]">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-cyan animate-ping" />
              <span>EVENT STARTS IN</span>
            </div>
          )}
        </div>

        {/* MASSIVE COUNTDOWN DIGITS (Dominant Element for 1080p and 4K) */}
        {timeLeft && (
          <div className="text-7xl sm:text-8xl md:text-9xl lg:text-[9.5rem] font-black tracking-wider flex items-center justify-center gap-2 sm:gap-4 md:gap-6 font-mono text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.3)]">
            <div className="flex flex-col items-center">
              <span className="leading-none">{timeLeft.hours}</span>
              <span className="text-[10px] md:text-xs font-mono tracking-widest text-gray-400 uppercase mt-2">
                HOURS
              </span>
            </div>

            <span className="text-4xl md:text-7xl lg:text-8xl text-neon-cyan opacity-80 leading-none mb-6">
              :
            </span>

            <div className="flex flex-col items-center">
              <span className="leading-none">{timeLeft.minutes}</span>
              <span className="text-[10px] md:text-xs font-mono tracking-widest text-gray-400 uppercase mt-2">
                MINUTES
              </span>
            </div>

            <span className="text-4xl md:text-7xl lg:text-8xl text-neon-cyan opacity-80 leading-none mb-6">
              :
            </span>

            <div className="flex flex-col items-center">
              <span className="leading-none text-neon-cyan drop-shadow-[0_0_30px_rgba(0,243,255,0.6)]">
                {timeLeft.seconds}
              </span>
              <span className="text-[10px] md:text-xs font-mono tracking-widest text-neon-cyan uppercase mt-2">
                SECONDS
              </span>
            </div>
          </div>
        )}

        {/* Event Subtitle Information */}
        {displayEvent && (
          <div className="mt-8 flex flex-col items-center text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider text-gray-100">
              {displayEvent.title}
            </h2>
            <div className="mt-2 text-xs md:text-sm font-mono text-gray-400 tracking-widest uppercase">
              {isCurrentActive
                ? `ENDS AT ${new Date(displayEvent.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : `STARTS AT ${new Date(displayEvent.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
