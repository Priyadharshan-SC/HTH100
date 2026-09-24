"use client";

import { useEffect, useState, useRef } from "react";
import JarvisOrb, { JarvisState } from "@/components/JarvisOrb";
import { AdminVoiceBroadcaster, VoiceStats, VoiceSessionInfo } from "@/lib/voiceClient";
import { getSocket } from "@/lib/socket";
import { Mic, MicOff, Radio, PhoneOff, Users, ShieldAlert, Wifi } from "lucide-react";

export default function CentralVoicePanel() {
  const [voiceStatus, setVoiceStatus] = useState<
    "IDLE" | "CONNECTING" | "LIVE" | "MUTED" | "LOCKED" | "ERROR"
  >("IDLE");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [connectedCount, setConnectedCount] = useState<number>(0);
  const [totalExpected, setTotalExpected] = useState<number>(24);
  const [smartBoards, setSmartBoards] = useState<Array<{ displayId: string; status: string }>>([]);
  const [controlledByAdmin, setControlledByAdmin] = useState<string | null>(null);
  const [controlRequestNotice, setControlRequestNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const broadcasterRef = useRef<AdminVoiceBroadcaster | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const broadcaster = new AdminVoiceBroadcaster();
    broadcasterRef.current = broadcaster;

    broadcaster.setStatsCallback((s) => {
      setStats(s);
    });

    // Check existing voice session state
    socket.emit("voice-get-state", (session: VoiceSessionInfo | null) => {
      if (session && session.active) {
        if (session.adminSocketId === socket.id) {
          setVoiceStatus(session.isMuted ? "MUTED" : "LIVE");
        } else {
          setVoiceStatus("LOCKED");
          setControlledByAdmin(session.adminName || "Another Admin");
        }
      }
    });

    // Listen for voice session events
    socket.on("voice-session-started", (data: { session: VoiceSessionInfo }) => {
      if (data.session.adminSocketId !== socket.id) {
        setVoiceStatus("LOCKED");
        setControlledByAdmin(data.session.adminName || "Another Admin");
      }
    });

    socket.on("voice-session-ended", () => {
      setVoiceStatus("IDLE");
      setControlledByAdmin(null);
      setControlRequestNotice(null);
    });

    socket.on("voice-mute-updated", (data: { isMuted: boolean }) => {
      if (voiceStatus === "LIVE" || voiceStatus === "MUTED") {
        setVoiceStatus(data.isMuted ? "MUTED" : "LIVE");
      }
    });

    socket.on("voice-control-requested", (data: { requestingAdmin: string }) => {
      setControlRequestNotice(`${data.requestingAdmin} is requesting control of Central Voice.`);
    });

    // Listen for Smart Board updates
    socket.on("smart-boards-updated", (data: { boards: any[]; connectedCount: number; totalExpected: number }) => {
      setConnectedCount(data.connectedCount);
      setTotalExpected(data.totalExpected);
      setSmartBoards(data.boards);
    });

    return () => {
      broadcaster.stopBroadcast();
      socket.off("voice-session-started");
      socket.off("voice-session-ended");
      socket.off("voice-mute-updated");
      socket.off("voice-control-requested");
      socket.off("smart-boards-updated");
    };
  }, []);

  const handleStartBroadcast = async () => {
    if (!broadcasterRef.current) return;
    setVoiceStatus("CONNECTING");
    setErrorMessage("");

    const adminName = localStorage.getItem("admin_email") || "Admin Lead";
    const adminId = "admin-1";

    const res = await broadcasterRef.current.startBroadcast(adminName, adminId);
    if (res.success) {
      setVoiceStatus("LIVE");
      setLocalStream(broadcasterRef.current.getLocalStream());
    } else {
      if (res.error === "CONTROLLED_BY_ANOTHER_ADMIN") {
        setVoiceStatus("LOCKED");
        setControlledByAdmin(res.error);
      } else {
        setVoiceStatus("ERROR");
        setErrorMessage(res.error || "Failed to start broadcast");
      }
    }
  };

  const handleToggleMute = () => {
    if (!broadcasterRef.current) return;
    const nextMuted = voiceStatus !== "MUTED";
    broadcasterRef.current.setMute(nextMuted);
    setVoiceStatus(nextMuted ? "MUTED" : "LIVE");
  };

  const handleEndBroadcast = () => {
    if (!broadcasterRef.current) return;
    broadcasterRef.current.stopBroadcast();
    setVoiceStatus("IDLE");
    setLocalStream(null);
  };

  const handleRequestControl = () => {
    const socket = getSocket();
    const adminName = localStorage.getItem("admin_email") || "Admin Lead";
    socket.emit("voice-request-control", { adminName });
    alert("Control request sent to active broadcasting admin.");
  };

  // Map voiceStatus to JarvisState for the visualization orb
  const orbState: JarvisState =
    voiceStatus === "LIVE"
      ? "SPEAKING"
      : voiceStatus === "MUTED"
      ? "CONNECTED"
      : voiceStatus === "CONNECTING"
      ? "CONNECTING"
      : voiceStatus === "ERROR"
      ? "DISCONNECTED"
      : "STANDBY";

  return (
    <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-dark-border gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-neon-green" />
            <h2 className="text-lg md:text-xl font-black text-white tracking-widest uppercase">
              CENTRAL VOICE CONTROL
            </h2>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            One-to-many WebRTC announcement broadcaster for Smart Boards
          </p>
        </div>

        {/* Live Broadcast Status Indicator */}
        <div className="flex items-center gap-3">
          {voiceStatus === "LIVE" && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 font-mono font-black text-xs uppercase animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>LIVE VOICE</span>
            </div>
          )}
          {voiceStatus === "MUTED" && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500 text-yellow-400 font-mono font-black text-xs uppercase">
              <MicOff className="w-3.5 h-3.5" />
              <span>MUTED</span>
            </div>
          )}
          {voiceStatus === "IDLE" && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-mono text-xs uppercase">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span>VOICE STANDBY</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Request Notification Banner */}
      {controlRequestNotice && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3 text-yellow-400 text-sm font-medium">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{controlRequestNotice}</span>
          </div>
          <button
            onClick={() => setControlRequestNotice(null)}
            className="text-xs text-gray-400 hover:text-white px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Core: JARVIS Interactive Visualizer & Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
        {/* Left: JARVIS Orb Preview */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-black/40 rounded-2xl border border-white/5">
          <JarvisOrb
            state={orbState}
            audioStream={localStream}
            size="md"
            labelOverride={
              voiceStatus === "LIVE"
                ? "YOU ARE LIVE"
                : voiceStatus === "MUTED"
                ? "MICROPHONE MUTED"
                : voiceStatus === "LOCKED"
                ? "SESSION LOCKED"
                : undefined
            }
          />
        </div>

        {/* Right: Operational Controls & Audience Monitor */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {voiceStatus === "IDLE" && (
              <button
                onClick={handleStartBroadcast}
                className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-neon-green text-dark font-black tracking-widest uppercase text-sm hover:shadow-[0_0_25px_rgba(57,255,20,0.5)] transition-all"
              >
                <Mic className="w-5 h-5" />
                <span>START VOICE BROADCAST</span>
              </button>
            )}

            {(voiceStatus === "LIVE" || voiceStatus === "MUTED") && (
              <>
                <button
                  onClick={handleToggleMute}
                  className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold tracking-wider uppercase text-sm transition-all border ${
                    voiceStatus === "MUTED"
                      ? "bg-yellow-400 text-dark border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                      : "bg-dark-panel hover:bg-white/10 text-white border-white/20"
                  }`}
                >
                  {voiceStatus === "MUTED" ? (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>UNMUTE MIC</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-5 h-5 text-gray-400" />
                      <span>MUTE MIC</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleEndBroadcast}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold tracking-wider uppercase text-sm transition-all"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>END BROADCAST</span>
                </button>
              </>
            )}

            {voiceStatus === "LOCKED" && (
              <div className="w-full flex flex-col gap-3 p-4 rounded-xl bg-red-950/30 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                  <ShieldAlert className="w-5 h-5" />
                  <span>LIVE — CONTROLLED BY ANOTHER ADMIN ({controlledByAdmin})</span>
                </div>
                <p className="text-xs text-gray-400">
                  Only one administrator can broadcast Central Voice at a time to prevent conflicting announcements.
                </p>
                <button
                  onClick={handleRequestControl}
                  className="self-start mt-1 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono font-bold uppercase transition-all"
                >
                  Request Control
                </button>
              </div>
            )}
          </div>

          {/* Connected Displays & WebRTC Quality Telemetry */}
          <div className="grid grid-cols-2 gap-4">
            {/* Display Audience Count */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-mono uppercase">
                <Users className="w-3.5 h-3.5 text-neon-green" />
                <span>Connected Displays</span>
              </div>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {connectedCount} <span className="text-sm text-gray-500 font-normal">/ {totalExpected}</span>
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                Smart Boards ready for broadcast
              </div>
            </div>

            {/* Connection Quality */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-gray-400 text-xs font-mono uppercase">
                <Wifi className="w-3.5 h-3.5 text-neon-cyan" />
                <span>Audio Transport Quality</span>
              </div>
              <div className="text-xl font-bold font-mono mt-1 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    stats?.quality === "POOR"
                      ? "bg-red-500"
                      : stats?.quality === "DEGRADED"
                      ? "bg-yellow-400"
                      : "bg-neon-green"
                  }`}
                />
                <span className="text-white text-base">
                  {stats ? stats.quality : "STABLE (OPUS)"}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                {stats ? `RTT ${stats.rtt}ms • Loss ${stats.packetLoss}%` : "Low-latency WebRTC ready"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
