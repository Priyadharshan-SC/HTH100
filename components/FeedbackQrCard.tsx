"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Maximize2, X, MessageSquare, Sparkles } from "lucide-react";

interface FeedbackQrCardProps {
  className?: string;
}

export default function FeedbackQrCard({ className = "" }: FeedbackQrCardProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <div
        className={`relative flex flex-col items-center bg-black/60 backdrop-blur-xl border border-neon-green/30 rounded-3xl p-3 sm:p-4 shadow-[0_0_35px_rgba(57,255,20,0.12)] select-none transition-all group hover:border-neon-green/60 ${className}`}
      >
        {/* Subtle Ambient Top Glow */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-36 h-8 bg-neon-green/15 blur-xl pointer-events-none" />

        {/* Header Badge */}
        <div className="w-full flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_#39ff14]" />
            <h3 className="font-mono font-bold tracking-[0.2em] uppercase text-[11px] sm:text-xs text-white flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-neon-green" />
              <span>FEEDBACK QR</span>
            </h3>
          </div>
          <span className="font-mono text-[9px] text-neon-green bg-neon-green/10 border border-neon-green/30 px-2 py-0.5 rounded font-black tracking-widest uppercase">
            LIVE
          </span>
        </div>

        {/* QR Code Container with High-Contrast White Background & Glowing Border */}
        <div
          onClick={() => setIsZoomed(true)}
          className="relative w-full max-w-[135px] sm:max-w-[150px] aspect-square rounded-2xl bg-white p-2 flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)] group-hover:shadow-[0_0_30px_rgba(57,255,20,0.35)] transition-all overflow-hidden"
          title="Click to enlarge QR Code"
        >
          <img
            src="/feedback-qr.jpeg"
            alt="Participant Feedback QR Code"
            className="w-full h-full object-contain rounded-lg"
          />

          {/* Hover Zoom Prompt Overlay */}
          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-neon-green font-mono text-xs font-bold">
            <Maximize2 className="w-4 h-4 animate-bounce" />
            <span className="text-[9px] tracking-wider uppercase text-white">TAP TO ZOOM</span>
          </div>
        </div>

        {/* Subtitle / Call to Action */}
        <div className="w-full mt-2.5 flex flex-col items-center text-center px-1">
          <div className="flex items-center gap-1.5 text-neon-green text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase">
            <MessageSquare className="w-3 h-3 text-neon-green" />
            <span>SCAN TO SHARE FEEDBACK</span>
          </div>
          <p className="text-[9px] text-gray-400 font-mono mt-0.5 tracking-wide">
            Your insights shape Hack The Horizon 2.0
          </p>
        </div>
      </div>

      {/* High-Resolution Full-Screen Modal Preview on Click */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-2xl cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="relative max-w-sm sm:max-w-md w-full bg-dark-panel border-2 border-neon-green/60 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-[0_0_80px_rgba(57,255,20,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title="Close QR"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse" />
                <h3 className="font-mono font-black text-sm tracking-widest uppercase text-white">
                  PARTICIPANT FEEDBACK
                </h3>
              </div>

              {/* Ultra-crisp QR box for easy scanning from 10ft away */}
              <div className="w-64 sm:w-80 aspect-square bg-white rounded-2xl p-4 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                <img
                  src="/feedback-qr.jpeg"
                  alt="Feedback QR Large"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>

              <div className="mt-5 text-center font-mono">
                <div className="text-xs sm:text-sm font-bold text-neon-green uppercase tracking-wider">
                  SCAN WITH ANY MOBILE CAMERA
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Share your hackathon experience & team feedback
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
