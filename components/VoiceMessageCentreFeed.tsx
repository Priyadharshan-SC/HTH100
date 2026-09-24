"use client";

import { Volume2, Play, Square, Radio, Clock } from "lucide-react";

export interface VoiceMessageItem {
  id: string;
  title: string;
  duration: number;
  targetVenues: string;
  adminName: string;
  createdAt: string;
  audioData?: string;
}

interface VoiceMessageCentreFeedProps {
  voiceNotes: VoiceMessageItem[];
  activePlayingId: string | null;
  playbackProgress?: number;
  onPlayNote: (note: VoiceMessageItem) => void;
  onStopNote: () => void;
}

export default function VoiceMessageCentreFeed({
  voiceNotes,
  activePlayingId,
  onPlayNote,
  onStopNote,
}: VoiceMessageCentreFeedProps) {
  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:15";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!voiceNotes || voiceNotes.length === 0) {
    return (
      <div className="w-full max-w-md flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-neon-cyan animate-pulse" />
            <h3 className="font-mono font-bold tracking-[0.25em] uppercase text-xs text-white">
              VOICE MSG CENTRE
            </h3>
          </div>
          <span className="font-mono text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded">
            0 MESSAGES
          </span>
        </div>
        <div className="text-gray-500 text-xs italic text-center py-6">
          No voice messages broadcasted yet. Standby for audio dispatch from Control Centre.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-neon-green animate-pulse" />
          <h3 className="font-mono font-bold tracking-[0.25em] uppercase text-xs text-white">
            VOICE MSG CENTRE
          </h3>
        </div>
        <span className="font-mono text-[10px] text-neon-green bg-neon-green/10 border border-neon-green/30 px-2 py-0.5 rounded">
          {voiceNotes.length} {voiceNotes.length === 1 ? "MESSAGE" : "MESSAGES"}
        </span>
      </div>

      {/* Message Feed List */}
      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
        {voiceNotes.slice(0, 5).map((note) => {
          const isPlaying = activePlayingId === note.id;

          return (
            <div
              key={note.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isPlaying
                  ? "bg-neon-green/10 border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.25)]"
                  : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.05]"
              }`}
            >
              {/* Top Row: Title & Timestamp */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Volume2
                    className={`w-4 h-4 ${
                      isPlaying ? "text-neon-green animate-bounce" : "text-neon-cyan"
                    }`}
                  />
                  <span className="font-black text-xs sm:text-sm text-white uppercase tracking-wide truncate max-w-[190px]">
                    {note.title || "Voice Announcement"}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-gray-400">
                  {new Date(note.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Middle Row: Meta Information (Target & Speaker) */}
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-3">
                <span className="text-gray-300">
                  By {note.adminName || "Organizer"}
                </span>
                <span className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20">
                  {note.targetVenues === "ALL" ? "ALL VENUES" : note.targetVenues}
                </span>
              </div>

              {/* Bottom Row: Replay Button & Audio Waveforms */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span>{formatDuration(note.duration)}</span>
                </div>

                {/* Animated Soundwave Equalizer when playing */}
                {isPlaying && (
                  <div className="flex items-center gap-1 h-3 px-2">
                    <span className="w-1 bg-neon-green h-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                    <span className="w-1 bg-neon-green h-2/3 animate-[pulse_0.4s_ease-in-out_infinite_0.1s]" />
                    <span className="w-1 bg-neon-green h-full animate-[pulse_0.7s_ease-in-out_infinite_0.2s]" />
                    <span className="w-1 bg-neon-green h-1/2 animate-[pulse_0.5s_ease-in-out_infinite_0.15s]" />
                    <span className="w-1 bg-neon-green h-4/5 animate-[pulse_0.6s_ease-in-out_infinite_0.05s]" />
                  </div>
                )}

                {/* Replay / Stop Action Button */}
                <button
                  onClick={() => (isPlaying ? onStopNote() : onPlayNote(note))}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    isPlaying
                      ? "bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30"
                      : "bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_12px_rgba(57,255,20,0.3)]"
                  }`}
                  title={isPlaying ? "Stop audio" : "Replay voice announcement"}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>STOP</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>REPLAY</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
