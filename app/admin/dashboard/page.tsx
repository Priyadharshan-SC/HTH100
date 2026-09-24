"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import JarvisOrb from "@/components/JarvisOrb";
import { getSocket } from "@/lib/socket";
import {
  Radio,
  Bell,
  Monitor,
  ArrowRight,
  Clock,
  Send,
  Layers,
  CheckCircle2,
  Tv,
  Database,
  Wifi,
} from "lucide-react";

export interface VenueItem {
  venueCode: string;
  venueName: string;
  status: "ONLINE" | "OFFLINE";
  trackName?: string;
  connectedDisplaysCount?: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [connectedDisplays, setConnectedDisplays] = useState<any[]>([]);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [broadcasterName, setBroadcasterName] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueItem[]>([]);

  // Quick broadcast form state
  const [quickTitle, setQuickTitle] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [quickType, setQuickType] = useState<"INFO" | "SUCCESS" | "WARNING" | "URGENT">("INFO");

  useEffect(() => {
    // Basic auth check
    if (!localStorage.getItem("admin_token")) {
      router.push("/admin/login");
    }

    // Fetch current and next events
    fetch("/api/events/current")
      .then((res) => res.json())
      .then((data) => {
        if (data.currentEvent) setCurrentEvent(data.currentEvent);
        if (data.nextEvent) setNextEvent(data.nextEvent);
      })
      .catch(() => {});

    // Fetch venues
    fetch("/api/venues")
      .then((res) => res.json())
      .then((data) => {
        if (data.venues) setVenues(data.venues);
      })
      .catch(() => {});

    // Listen to real-time events & voice
    const socket = getSocket();

    socket.emit("REQUEST_CURRENT_STATE", (state: any) => {
      if (state?.venues) setVenues(state.venues);
      if (state?.currentEvent) setCurrentEvent(state.currentEvent);
      if (state?.nextEvent) setNextEvent(state.nextEvent);
      if (state?.voiceSession?.active) {
        setVoiceActive(true);
        setBroadcasterName(state.voiceSession.adminName);
      }
    });

    socket.emit("voice-get-state", (session: any) => {
      if (session && session.active) {
        setVoiceActive(true);
        setBroadcasterName(session.adminName);
      }
    });

    socket.on("voice-session-started", (data: any) => {
      setVoiceActive(true);
      setBroadcasterName(data.session?.adminName || "Organizer");
    });

    socket.on("voice-session-ended", () => {
      setVoiceActive(false);
      setBroadcasterName(null);
    });

    socket.on("VOICE_STARTED", (data: any) => {
      setVoiceActive(true);
      setBroadcasterName(data.session?.adminName || "Organizer");
    });

    socket.on("VOICE_ENDED", () => {
      setVoiceActive(false);
      setBroadcasterName(null);
    });

    socket.on("smart-boards-updated", (data: any) => {
      if (data.boards) setConnectedDisplays(data.boards);
    });

    socket.on("DISPLAY_CONNECTED", (data: any) => {
      if (data.display) {
        setConnectedDisplays((prev) => [
          ...prev.filter((d) => d.socketId !== data.display.socketId),
          data.display,
        ]);
      }
    });

    socket.on("DISPLAY_DISCONNECTED", (data: any) => {
      setConnectedDisplays((prev) => prev.filter((d) => d.socketId !== data.socketId));
    });

    socket.on("VENUE_UPDATED", (data: { venueCode: string; status: "ONLINE" | "OFFLINE" }) => {
      setVenues((prev) =>
        prev.map((v) => (v.venueCode === data.venueCode ? { ...v, status: data.status } : v))
      );
    });

    return () => {
      socket.off("voice-session-started");
      socket.off("voice-session-ended");
      socket.off("VOICE_STARTED");
      socket.off("VOICE_ENDED");
      socket.off("smart-boards-updated");
      socket.off("DISPLAY_CONNECTED");
      socket.off("DISPLAY_DISCONNECTED");
      socket.off("VENUE_UPDATED");
    };
  }, [router]);

  const handleQuickBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickMessage.trim()) return;

    try {
      const res = await fetch("/api/alerts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          title: quickTitle,
          message: quickMessage,
          type: quickType,
          priority: quickType === "URGENT" ? "HIGH" : "NORMAL",
          duration: 15,
          targetType: "ALL",
          targetVenues: "ALL",
          createdAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setQuickTitle("");
        setQuickMessage("");
        alert("Alert broadcasted to all 13 venues!");
      }
    } catch (e) {
      alert("Error broadcasting alert.");
    }
  };

  const totalVenues = venues.length || 13;
  const onlineVenues = venues.filter((v) => {
    return (
      v.status === "ONLINE" ||
      connectedDisplays.some((d) => d.venueCode === v.venueCode && d.status === "CONNECTED")
    );
  }).length;
  const activeDisplaysCount = connectedDisplays.filter((d) => d.status === "CONNECTED").length;

  return (
    <div className="flex min-h-screen bg-dark text-white select-none">
      <AdminSidebar />

      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-dark-border mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-widest uppercase text-white">
              OPERATIONS CONTROL CENTRE
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Live command dashboard for Hack The Horizon 2.0 • 13 Physical Venues
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-neon-green">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse" />
              <span>REALTIME: CONNECTED</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-neon-cyan">
              <Database className="w-3.5 h-3.5 text-neon-cyan" />
              <span>DB: HEALTHY</span>
            </div>
          </div>
        </div>

        {/* SECTION 19: ADMIN DASHBOARD SUMMARY TELEMETRY (5 METRICS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {/* Venues */}
          <div className="p-5 rounded-2xl bg-dark-panel border border-dark-border flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase text-gray-400 flex items-center justify-between">
              <span>VENUES</span>
              <Layers className="w-4 h-4 text-neon-green" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-3xl font-black font-mono text-white">
                13 <span className="text-xs text-gray-400 font-normal">TOTAL</span>
              </div>
              <div className="text-[10px] font-mono text-neon-green mt-1">
                {onlineVenues} ACTIVE ONLINE
              </div>
            </div>
          </div>

          {/* Displays */}
          <div className="p-5 rounded-2xl bg-dark-panel border border-dark-border flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase text-gray-400 flex items-center justify-between">
              <span>DISPLAYS</span>
              <Tv className="w-4 h-4 text-neon-cyan" />
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-3xl font-black font-mono text-neon-cyan">
                {activeDisplaysCount}{" "}
                <span className="text-xs text-gray-400 font-normal">/ 24</span>
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                Smart Board TVs
              </div>
            </div>
          </div>

          {/* Central Voice */}
          <div className="p-5 rounded-2xl bg-dark-panel border border-dark-border flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase text-gray-400 flex items-center justify-between">
              <span>VOICE SFU</span>
              <Radio
                className={`w-4 h-4 ${
                  voiceActive ? "text-red-500 animate-pulse" : "text-gray-500"
                }`}
              />
            </div>
            <div className="mt-3">
              <div
                className={`text-xl lg:text-2xl font-black font-mono ${
                  voiceActive ? "text-red-400" : "text-gray-400"
                }`}
              >
                {voiceActive ? "● LIVE" : "IDLE"}
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                {voiceActive ? `By ${broadcasterName || "Admin"}` : "Standby channel"}
              </div>
            </div>
          </div>

          {/* Realtime Engine */}
          <div className="p-5 rounded-2xl bg-dark-panel border border-dark-border flex flex-col justify-between">
            <div className="text-[11px] font-mono uppercase text-gray-400 flex items-center justify-between">
              <span>REALTIME</span>
              <Wifi className="w-4 h-4 text-neon-green" />
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-black font-mono text-neon-green">
                CONNECTED
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                Socket.IO Zero-Lag
              </div>
            </div>
          </div>

          {/* Database Health */}
          <div className="p-5 rounded-2xl bg-dark-panel border border-dark-border flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="text-[11px] font-mono uppercase text-gray-400 flex items-center justify-between">
              <span>DATABASE</span>
              <Database className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="mt-3">
              <div className="text-xl lg:text-2xl font-black font-mono text-emerald-400">
                HEALTHY
              </div>
              <div className="text-[10px] font-mono text-gray-400 mt-1">
                Prisma SQLite Sync
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 19: VENUE BREAKDOWN MATRIX */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 mb-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-dark-border mb-6">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-neon-green" />
              <h2 className="text-sm font-black tracking-widest uppercase text-white">
                VENUE STATUS BREAKDOWN (ALL 13 VENUES)
              </h2>
            </div>
            <Link
              href="/admin/live-monitor"
              className="text-xs font-mono text-neon-cyan hover:underline font-bold uppercase flex items-center gap-1"
            >
              <span>Detailed Monitor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {venues.map((v) => {
              const count = connectedDisplays.filter(
                (d) => d.venueCode === v.venueCode && d.status === "CONNECTED"
              ).length;
              const isOnline = count > 0 || v.status === "ONLINE";

              return (
                <div
                  key={v.venueCode}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isOnline
                      ? "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                      : "bg-black/30 border-white/5 opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-black text-xs text-white">
                      {v.venueCode}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOnline
                          ? "bg-neon-green animate-pulse shadow-[0_0_6px_#39ff14]"
                          : "bg-red-500/70"
                      }`}
                    />
                  </div>

                  <div className="text-[11px] text-gray-300 font-medium truncate mb-2">
                    {v.venueName}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                    <span className={isOnline ? "text-neon-green font-bold" : "text-gray-500"}>
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </span>
                    <span className="text-gray-400">
                      {count} disp
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Middle Row: Central Voice + Event Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          {/* Central Voice Quick Hub */}
          <div className="lg:col-span-6 bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-dark-border mb-6">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-neon-green" />
                  <h2 className="text-sm font-black tracking-widest uppercase text-white">
                    CENTRAL VOICE (JARVIS)
                  </h2>
                </div>
                {voiceActive ? (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500 text-red-400 font-mono text-xs font-bold uppercase animate-pulse">
                    LIVE VOICE ({broadcasterName})
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 font-mono text-xs uppercase">
                    STANDBY
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center py-4">
                <JarvisOrb
                  state={voiceActive ? "SPEAKING" : "STANDBY"}
                  size="md"
                  labelOverride={voiceActive ? "LIVE BROADCAST ACTIVE" : "JARVIS CORE READY"}
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-dark-border flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono">
                WebRTC Low-Latency Voice SFU
              </span>
              <Link
                href="/admin/voice"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-green text-dark font-black text-xs uppercase tracking-wider hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all"
              >
                <span>OPEN VOICE CONSOLE</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Event Status */}
          <div className="lg:col-span-6 bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-dark-border mb-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-neon-cyan" />
                  <h2 className="text-sm font-black tracking-widest uppercase text-white">
                    TIMELINE STATUS
                  </h2>
                </div>
                <Link
                  href="/admin/schedule"
                  className="text-xs font-mono text-neon-cyan hover:underline font-bold uppercase"
                >
                  Configure
                </Link>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono font-bold text-neon-green uppercase tracking-widest block mb-1">
                    CURRENT STAGE
                  </span>
                  <div className="text-xl font-black uppercase text-white">
                    {currentEvent ? currentEvent.title : "HACKATHON LAUNCH"}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-1">
                    {currentEvent
                      ? `ENDS: ${new Date(currentEvent.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Stage in progress"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono font-bold text-neon-cyan uppercase tracking-widest block mb-1">
                    NEXT UPCOMING STAGE
                  </span>
                  <div className="text-xl font-black uppercase text-white">
                    {nextEvent ? nextEvent.title : "MENTOR EVALUATION ROUND 1"}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-1">
                    {nextEvent
                      ? `STARTS: ${new Date(nextEvent.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Scheduled soon"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-dark-border flex items-center justify-end">
              <Link
                href="/admin/schedule"
                className="flex items-center gap-2 text-xs font-mono text-neon-green hover:underline font-bold uppercase"
              >
                <span>Edit Schedule & Display Toggles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Quick Broadcast Alert Section */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-dark-border mb-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-neon-green" />
              <h2 className="text-sm font-black tracking-widest uppercase text-white">
                QUICK BROADCAST ALERT (ALL 13 VENUES)
              </h2>
            </div>
            <Link
              href="/admin/alerts"
              className="text-xs font-mono text-neon-green hover:underline font-bold uppercase flex items-center gap-1"
            >
              <span>Targeted Alert Centre</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <form onSubmit={handleQuickBroadcast} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Alert Title (e.g. Mentor Review In 10 Mins)"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-neon-green"
                />
              </div>

              <div>
                <select
                  value={quickType}
                  onChange={(e: any) => setQuickType(e.target.value)}
                  className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-neon-green"
                >
                  <option value="INFO">INFO (Cyan)</option>
                  <option value="SUCCESS">SUCCESS (Green)</option>
                  <option value="WARNING">WARNING (Yellow)</option>
                  <option value="URGENT">URGENT (Red)</option>
                </select>
              </div>
            </div>

            <div>
              <textarea
                required
                placeholder="Alert Message to broadcast across all 13 venues..."
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-neon-green min-h-[70px]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-cyan text-dark font-black text-xs uppercase tracking-widest hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Broadcast to 13 Venues</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
