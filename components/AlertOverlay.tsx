"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/lib/socket";

export type AlertType = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "URGENT";
  priority: "NORMAL" | "HIGH";
  duration: number; // in seconds
  createdAt: string;
};

export default function AlertOverlay() {
  const [activeAlerts, setActiveAlerts] = useState<AlertType[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio("/alert.mp3"); // We need to create/place this file
    audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleNewAlert = (alert: AlertType) => {
      setActiveAlerts((prev) => {
        // Prevent duplicate alerts
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [...prev, alert];
      });

      // Try playing sound if enabled
      if (audioEnabled && audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.warn("Audio play blocked by browser:", err);
        });
      }

      // Auto-remove after duration
      setTimeout(() => {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }, alert.duration * 1000);
    };

    socket.on("new-alert", handleNewAlert);

    return () => {
      socket.off("new-alert", handleNewAlert);
    };
  }, [audioEnabled]);

  const getAlertColors = (type: string) => {
    switch (type) {
      case "URGENT":
        return "border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
      case "WARNING":
        return "border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]";
      case "SUCCESS":
        return "border-neon-green text-neon-green shadow-[0_0_15px_rgba(57,255,20,0.5)]";
      case "INFO":
      default:
        return "border-neon-cyan text-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.5)]";
    }
  };

  return (
    <>
      {/* Audio permission button - absolutely positioned, subtle */}
      {!audioEnabled && (
        <button
          onClick={() => setAudioEnabled(true)}
          className="fixed bottom-4 right-4 z-50 text-xs text-gray-500 hover:text-white transition-colors"
        >
          Enable Sound 🔊
        </button>
      )}

      {/* Alerts Container */}
      <div className="fixed inset-0 pointer-events-none z-[100] flex flex-col items-center justify-center p-4">
        <AnimatePresence>
          {activeAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 1.1, filter: "blur(10px)" }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
              className={`pointer-events-auto bg-dark/95 backdrop-blur-md border-2 p-8 max-w-2xl w-full text-center rounded-2xl mb-4 relative overflow-hidden ${getAlertColors(
                alert.type
              )}`}
            >
              {/* Scanline effect */}
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(255,255,255,0.05)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50"></div>
              
              <h2 className="text-3xl font-black tracking-widest uppercase mb-4">
                {alert.title}
              </h2>
              <p className="text-xl font-medium text-white">{alert.message}</p>
              
              {/* Progress bar representing duration */}
              <motion.div 
                className="absolute bottom-0 left-0 h-1 bg-current"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: alert.duration, ease: "linear" }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
