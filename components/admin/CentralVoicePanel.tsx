"use client";

import { useEffect, useState, useRef } from "react";
import JarvisOrb, { JarvisState } from "@/components/JarvisOrb";
import { getSocket } from "@/lib/socket";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Radio,
  Volume2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  AlertCircle,
  Trash2
} from "lucide-react";

interface RecentVoiceNote {
  id: string;
  title: string;
  duration: number;
  targetVenues: string;
  adminName: string;
  createdAt: string;
}

const VENUE_LIST = [
  "ALL",
  "VENUE-01",
  "VENUE-02",
  "VENUE-03",
  "VENUE-04",
  "VENUE-05",
  "VENUE-06",
  "VENUE-07",
  "VENUE-08",
  "VENUE-09",
  "VENUE-10",
  "VENUE-11",
  "VENUE-12",
  "VENUE-13",
];

export default function CentralVoicePanel() {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  // Playback preview state
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  // Dispatch parameters
  const [targetVenue, setTargetVenue] = useState<string>("ALL");
  const [announcementTitle, setAnnouncementTitle] = useState<string>("Important Announcement");
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // History
  const [recentNotes, setRecentNotes] = useState<RecentVoiceNote[]>([]);
  const [historyPlayingId, setHistoryPlayingId] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const historyAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch recent voice notes on mount
  useEffect(() => {
    fetchRecentNotes();
  }, []);

  const fetchRecentNotes = async () => {
    try {
      const res = await fetch("/api/voice/broadcast");
      if (res.ok) {
        const data = await res.json();
        if (data.voiceNotes) {
          setRecentNotes(data.voiceNotes);
        }
      }
    } catch (e) {
      console.warn("Could not fetch recent voice notes:", e);
    }
  };

  // Recording controls
  const startRecording = async () => {
    setDispatchSuccess(null);
    setDispatchError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Convert blob to base64 data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioBase64(base64data);
        };
        reader.readAsDataURL(blob);

        // Stop stream tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordDuration(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setDispatchError(
        err.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone permissions."
          : "Could not access microphone."
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const discardRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPlayingPreview(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setRecordDuration(0);
    setPreviewProgress(0);
  };

  // Preview audio handlers
  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  // Dispatch voice note to venues
  const handleDispatch = async () => {
    if (!audioBase64) {
      setDispatchError("Please record a voice note before dispatching.");
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);
    setDispatchSuccess(null);

    const adminEmail = localStorage.getItem("admin_email") || "Admin Lead";

    try {
      const payload = {
        title: announcementTitle || "Voice Announcement",
        audioData: audioBase64,
        mimeType: audioBlob?.type || "audio/webm",
        duration: recordDuration,
        targetVenues: targetVenue,
        adminName: adminEmail,
      };

      // 1. Post to REST API (stored in Neon PostgreSQL)
      const res = await fetch("/api/voice/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to dispatch voice note to server");
      }

      const data = await res.json();

      // 2. Also emit through Socket.IO for instant zero-delay delivery
      const socket = getSocket();
      socket.emit("voice-note-broadcast", data.voiceNote);

      setDispatchSuccess(
        `Voice note successfully dispatched to ${
          targetVenue === "ALL" ? "All 13 Venues" : targetVenue
        }!`
      );

      // Refresh recent notes
      fetchRecentNotes();

      // Clean up current recording after 2 seconds
      setTimeout(() => {
        discardRecording();
      }, 2000);
    } catch (err: any) {
      console.error("Dispatch error:", err);
      setDispatchError(err.message || "Failed to dispatch voice note.");
    } finally {
      setIsDispatching(false);
    }
  };

  // Re-dispatch a previous note (Creates new broadcast with fresh ID & timestamp)
  const handleRedispatch = async (note: RecentVoiceNote) => {
    const confirmRedispatch = confirm(
      `Re-broadcast "${note.title}" to ${note.targetVenues === "ALL" ? "All 13 Venues" : note.targetVenues}?`
    );
    if (!confirmRedispatch) return;

    setIsDispatching(true);
    setDispatchError(null);
    setDispatchSuccess(null);

    const adminEmail = localStorage.getItem("admin_email") || "Admin Lead";

    try {
      const res = await fetch("/api/voice/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "redispatch",
          id: note.id,
          targetVenues: note.targetVenues,
          adminName: adminEmail,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to re-dispatch voice note");
      }

      const data = await res.json();

      // Emit through Socket.IO for instant delivery
      const socket = getSocket();
      socket.emit("voice-note-broadcast", data.voiceNote);

      setDispatchSuccess(
        `Voice note "${note.title}" successfully re-broadcast to ${
          note.targetVenues === "ALL" ? "All 13 Venues" : note.targetVenues
        }!`
      );

      // Refresh list to show newly dispatched item at top
      fetchRecentNotes();
    } catch (err: any) {
      console.error("Re-dispatch error:", err);
      setDispatchError(err.message || "Failed to re-dispatch voice note.");
    } finally {
      setIsDispatching(false);
    }
  };

  // Delete a voice note permanently
  const handleDeleteNote = async (note: RecentVoiceNote) => {
    const confirmDelete = confirm(`Are you sure you want to permanently delete "${note.title}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/voice/broadcast?id=${note.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete voice note");
      }

      setRecentNotes((prev) => prev.filter((n) => n.id !== note.id));
      setDispatchSuccess(`Successfully deleted "${note.title}".`);

      if (historyPlayingId === note.id) {
        historyAudioRef.current?.pause();
        setHistoryPlayingId(null);
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      setDispatchError(err.message || "Failed to delete voice note.");
    }
  };

  // Play or pause historical audio note preview
  const handlePlayHistoryNote = async (note: RecentVoiceNote) => {
    if (historyPlayingId === note.id) {
      historyAudioRef.current?.pause();
      setHistoryPlayingId(null);
      return;
    }

    try {
      const res = await fetch(`/api/voice/broadcast?id=${note.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.voiceNote?.audioData && historyAudioRef.current) {
        historyAudioRef.current.src = data.voiceNote.audioData;
        historyAudioRef.current.play();
        setHistoryPlayingId(note.id);
        historyAudioRef.current.onended = () => setHistoryPlayingId(null);
      }
    } catch (e) {
      console.error("Failed to load historical audio note:", e);
    }
  };

  // Format seconds as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Visualizer orb state
  const orbState: JarvisState = isRecording
    ? "SPEAKING"
    : isPlayingPreview
    ? "CONNECTED"
    : isDispatching
    ? "CONNECTING"
    : "STANDBY";

  return (
    <div className="flex flex-col gap-8">
      {/* Hidden Audio Element for Preview */}
      {audioUrl && (
        <audio
          ref={previewAudioRef}
          src={audioUrl}
          onEnded={() => {
            setIsPlayingPreview(false);
            setPreviewProgress(0);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) {
              setPreviewProgress((el.currentTime / el.duration) * 100);
            }
          }}
        />
      )}

      {/* Hidden Audio Element for Historical Note Playback */}
      <audio ref={historyAudioRef} className="hidden" />

      {/* Main Broadcast Studio Card */}
      <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-green/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-cyan/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-dark-border gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-neon-green animate-pulse" />
              <h2 className="text-lg md:text-xl font-black text-white tracking-widest uppercase">
                CENTRAL VOICE NOTE RECORDER & DISPATCH
              </h2>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Record voice announcements with preview and broadcast directly to Smart Board End Screens
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isRecording ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 font-mono font-black text-xs uppercase animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>RECORDING IN PROGRESS</span>
              </div>
            ) : audioBlob ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-mono font-bold text-xs uppercase">
                <Volume2 className="w-3.5 h-3.5" />
                <span>READY TO BROADCAST</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-mono text-xs uppercase">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span>STANDBY</span>
              </div>
            )}
          </div>
        </div>

        {/* Success or Error Feedback */}
        {dispatchSuccess && (
          <div className="p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 flex items-center gap-3 text-neon-green text-sm font-mono">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{dispatchSuccess}</span>
          </div>
        )}

        {dispatchError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-sm font-mono">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{dispatchError}</span>
          </div>
        )}

        {/* Center Grid: Jarvis Visualizer + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-2">
          {/* Left: Jarvis Visualizer Orb */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-black/40 rounded-2xl border border-white/5 relative">
            <JarvisOrb
              state={orbState}
              size="md"
              labelOverride={
                isRecording
                  ? `RECORDING: ${formatTime(recordDuration)}`
                  : isPlayingPreview
                  ? "PLAYING PREVIEW"
                  : isDispatching
                  ? "TRANSMITTING..."
                  : audioBlob
                  ? "VOICE READY"
                  : "PRESS RECORD TO START"
              }
            />

            {/* Recording Timer Display */}
            {isRecording && (
              <div className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 font-mono font-bold text-sm tracking-widest animate-pulse">
                <Clock className="w-4 h-4" />
                <span>{formatTime(recordDuration)} / 01:00 MAX</span>
              </div>
            )}
          </div>

          {/* Right: Operational Controls */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Step 1: Record or Preview */}
            {!audioBlob ? (
              <div className="flex flex-col gap-4">
                <label className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-neon-green" />
                  <span>Step 1: Record Announcement</span>
                </label>

                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-full py-5 rounded-2xl bg-neon-green text-dark font-black tracking-widest uppercase text-base hover:shadow-[0_0_35px_rgba(57,255,20,0.6)] hover:bg-neon-green/90 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Mic className="w-6 h-6 animate-pulse" />
                    <span>START RECORDING VOICE NOTE</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="w-full py-5 rounded-2xl bg-red-600 text-white font-black tracking-widest uppercase text-base hover:shadow-[0_0_35px_rgba(239,68,68,0.7)] hover:bg-red-500 transition-all flex items-center justify-center gap-3 cursor-pointer animate-pulse"
                  >
                    <Square className="w-6 h-6 fill-current" />
                    <span>STOP RECORDING ({formatTime(recordDuration)})</span>
                  </button>
                )}
                <p className="text-[11px] text-gray-500 font-mono">
                  Speak clearly into your microphone. Once stopped, you can preview the audio before broadcasting.
                </p>
              </div>
            ) : (
              /* Preview Player */
              <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-neon-cyan uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Step 1: Preview Voice Note ({formatTime(recordDuration)})</span>
                  </div>
                  <button
                    onClick={discardRecording}
                    className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 font-mono transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-record</span>
                  </button>
                </div>

                {/* Audio scrubber/progress bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon-cyan transition-all duration-100"
                    style={{ width: `${previewProgress}%` }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePreviewPlay}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    {isPlayingPreview ? (
                      <>
                        <Pause className="w-4 h-4 text-neon-cyan" />
                        <span>Pause Preview</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 text-neon-green" />
                        <span>Play Preview</span>
                      </>
                    )}
                  </button>
                  <span className="text-xs font-mono text-gray-400">
                    Duration: {formatTime(recordDuration)}
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: Target Venue Selection */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-neon-cyan" />
                <span>Step 2: Select Target Audience</span>
              </label>

              {/* Quick toggle chips */}
              <div className="flex flex-wrap gap-2">
                {VENUE_LIST.map((venue) => {
                  const isSelected = targetVenue === venue;
                  return (
                    <button
                      key={venue}
                      onClick={() => setTargetVenue(venue)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all border ${
                        isSelected
                          ? "bg-neon-green text-black border-neon-green shadow-[0_0_15px_rgba(57,255,20,0.4)]"
                          : "bg-black/40 hover:bg-white/10 text-gray-400 border-white/10"
                      }`}
                    >
                      {venue === "ALL" ? "ALL VENUES (BROADCAST)" : venue}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Announcement Title */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Announcement Subject
              </label>
              <input
                type="text"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. Round 1 Coding Begins Now"
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-neon-green transition-colors"
              />
            </div>

            {/* Step 4: Dispatch Button */}
            <button
              onClick={handleDispatch}
              disabled={!audioBlob || isDispatching}
              className={`w-full py-4 rounded-xl font-black tracking-widest uppercase text-sm flex items-center justify-center gap-3 transition-all ${
                !audioBlob || isDispatching
                  ? "bg-white/10 text-gray-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-neon-green via-emerald-400 to-neon-green text-dark shadow-[0_0_30px_rgba(57,255,20,0.5)] hover:shadow-[0_0_40px_rgba(57,255,20,0.7)] cursor-pointer"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isDispatching
                  ? "DISPATCHING VOICE NOTE TO END SCREENS..."
                  : `DISPATCH VOICE NOTE TO ${
                      targetVenue === "ALL" ? "ALL 13 VENUES" : targetVenue
                    }`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Dispatched Announcements History */}
      <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neon-cyan" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Recent Voice Dispatches
            </h3>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {recentNotes.length} announcements recorded
          </span>
        </div>

        {recentNotes.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-gray-500">
            No voice announcements dispatched yet. Record your first voice note above.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentNotes.map((note) => (
              <div
                key={note.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.01] px-2 rounded-lg transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white tracking-wide">
                    {note.title}
                  </span>
                  <div className="flex items-center gap-3 text-xs font-mono text-gray-400 mt-1">
                    <span className="text-neon-cyan font-bold">
                      {note.targetVenues === "ALL" ? "ALL VENUES" : note.targetVenues}
                    </span>
                    <span>•</span>
                    <span>{Math.round(note.duration)}s</span>
                    <span>•</span>
                    <span>{new Date(note.createdAt).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span className="text-gray-500">By {note.adminName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Listen Preview */}
                  <button
                    onClick={() => handlePlayHistoryNote(note)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                      historyPlayingId === note.id
                        ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
                    }`}
                    title="Listen to recording preview"
                  >
                    {historyPlayingId === note.id ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-neon-cyan" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  {/* Re-Broadcast to Venues */}
                  <button
                    onClick={() => handleRedispatch(note)}
                    disabled={isDispatching}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-neon-green/20 text-gray-300 hover:text-neon-green border border-white/10 hover:border-neon-green/40 text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Re-broadcast announcement to venues"
                  >
                    <Send className="w-3 h-3" />
                    <span>Re-Broadcast</span>
                  </button>

                  {/* Delete Announcement */}
                  <button
                    onClick={() => handleDeleteNote(note)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/40 text-xs font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                    title="Delete announcement permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
