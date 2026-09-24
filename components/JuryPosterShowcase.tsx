"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Maximize2, X, Sparkles, Award } from "lucide-react";

export const JURY_POSTERS = [
  { id: 5, src: "/jury/5.png", label: "Jury Member 01" },
  { id: 6, src: "/jury/6.png", label: "Jury Member 02" },
  { id: 7, src: "/jury/7.png", label: "Jury Member 03" },
  { id: 8, src: "/jury/8.png", label: "Jury Member 04" },
  { id: 9, src: "/jury/9.png", label: "Jury Member 05" },
  { id: 10, src: "/jury/10.png", label: "Jury Member 06" },
  { id: 11, src: "/jury/11.png", label: "Jury Member 07" },
  { id: 12, src: "/jury/12.png", label: "Jury Member 08" },
  { id: 13, src: "/jury/13.png", label: "Jury Member 09" },
  { id: 14, src: "/jury/14.png", label: "Jury Member 10" },
  { id: 15, src: "/jury/15.png", label: "Jury Member 11" },
];

const SLIDE_INTERVAL_MS = 4500; // 4.5 seconds per poster slide

interface JuryPosterShowcaseProps {
  className?: string;
}

export default function JuryPosterShowcase({ className = "" }: JuryPosterShowcaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = down/up, -1 = reverse
  const [isPaused, setIsPaused] = useState(false);
  const [modalPoster, setModalPoster] = useState<string | null>(null);

  // Auto-advance slideshow timer
  useEffect(() => {
    if (isPaused || modalPoster !== null) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % JURY_POSTERS.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isPaused, modalPoster]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % JURY_POSTERS.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + JURY_POSTERS.length) % JURY_POSTERS.length);
  };

  const currentPoster = JURY_POSTERS[currentIndex];

  // Vertical slide transition variants
  const slideVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.96,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        y: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
        scale: { duration: 0.4 },
      },
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -80 : 80,
      opacity: 0,
      scale: 0.96,
      transition: {
        y: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 },
      },
    }),
  };

  return (
    <>
      <div
        className={`relative flex flex-col items-center bg-black/60 backdrop-blur-xl border border-neon-cyan/30 rounded-3xl p-3 sm:p-4 shadow-[0_0_40px_rgba(0,243,255,0.15)] select-none transition-all ${className}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-10 bg-neon-cyan/20 blur-2xl pointer-events-none" />

        {/* Header Badge */}
        <div className="w-full flex items-center justify-between pb-2.5 mb-2 border-b border-white/10 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_8px_#39ff14]" />
            <h3 className="font-mono font-bold tracking-[0.2em] uppercase text-[11px] sm:text-xs text-white flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-neon-cyan" />
              <span>JURY PANEL</span>
            </h3>
          </div>
          <span className="font-mono text-[10px] text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 px-2 py-0.5 rounded font-black">
            {currentIndex + 1} / {JURY_POSTERS.length}
          </span>
        </div>

        {/* Vertical Slide Window (2:3 Aspect Ratio) */}
        <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-black/80 border border-white/10 group cursor-pointer shadow-inner">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentPoster.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 w-full h-full"
              onClick={() => setModalPoster(currentPoster.src)}
            >
              <img
                src={currentPoster.src}
                alt={currentPoster.label}
                className="w-full h-full object-cover rounded-2xl"
                loading="eager"
              />
              {/* Subtle hover gradient and zoom cue */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                <span className="text-[10px] font-mono font-bold uppercase text-white tracking-wider">
                  {currentPoster.label}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-neon-cyan bg-black/60 px-2 py-0.5 rounded border border-neon-cyan/40">
                  <Maximize2 className="w-3 h-3" />
                  <span>ZOOM</span>
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Futuristic Scanline Effect */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
        </div>

        {/* Controls & Progress Indicator Bar */}
        <div className="w-full mt-3 flex items-center justify-between gap-2 px-1">
          {/* Pause / Play Indicator */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
            {isPaused ? (
              <span className="text-yellow-400 font-bold">PAUSED</span>
            ) : (
              <span className="text-gray-400">AUTO SLIDE</span>
            )}
          </div>

          {/* Up & Down Vertical Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all border border-white/10"
              title="Previous jury poster"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white transition-all border border-white/10"
              title="Next jury poster"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Animated Progress Bar (Loops every 4.5 seconds when not paused) */}
        <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
          <motion.div
            key={currentIndex}
            className="h-full bg-gradient-to-r from-neon-green to-neon-cyan"
            initial={{ width: "0%" }}
            animate={{ width: isPaused ? "100%" : "100%" }}
            transition={{
              duration: isPaused ? 0 : SLIDE_INTERVAL_MS / 1000,
              ease: "linear",
            }}
          />
        </div>
      </div>

      {/* High-Resolution Full-Screen Modal Preview on Click */}
      <AnimatePresence>
        {modalPoster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl cursor-pointer"
            onClick={() => setModalPoster(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="relative max-h-[90vh] max-w-lg w-full aspect-[2/3] rounded-3xl overflow-hidden border-2 border-neon-cyan/50 shadow-[0_0_80px_rgba(0,243,255,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={modalPoster}
                alt="Jury Poster Preview"
                className="w-full h-full object-contain bg-black"
              />
              <button
                onClick={() => setModalPoster(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all cursor-pointer"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
