"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getSocket } from "@/lib/socket";
import {
  Monitor,
  Radio,
  Wifi,
  Tv,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Layers,
} from "lucide-react";

export interface VenueInfo {
  id: string;
  venueCode: string;
  venueName: string;
  displayName: string;
  trackName?: string;
  status: "ONLINE" | "RECONNECTING" | "OFFLINE";
  updatedAt?: string;
}

export interface DisplayInfo {
  socketId: string;
  venueCode: string;
  displayId: string;
  displayName: string;
  status: string;
  connectedAt: string;
  metadata?: {
    resolution?: string;
    userAgent?: string;
  };
}

export default function AdminLiveMonitorPage() {
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [currentEventTitle, setCurrentEventTitle] = useState<string>("Hackathon Main Phase");
  const [filter, setFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [search, setSearch] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  const [refreshingAll, setRefreshingAll] = useState(false);

  const handleRefreshAllUserViews = () => {
    setRefreshingAll(true);
    const socket = getSocket();
    socket.emit("admin-trigger-refresh", {}, () => {
      setTimeout(() => setRefreshingAll(false), 2000);
    });
    setTimeout(() => setRefreshingAll(false), 2000);
  };

  // Fetch initial venues and poll for live status
  useEffect(() => {
    const fetchVenues = () => {
      fetch("/api/venues")
        .then((res) => res.json())
        .then((data) => {
          if (data?.venues) {
            setVenues(data.venues);
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        })
        .catch((err) => console.error("Error fetching venues:", err));
    };

    fetchVenues();
    const interval = setInterval(fetchVenues, 4000);

    const socket = getSocket();

    // 1. Initial State Sync
    socket.emit("REQUEST_CURRENT_STATE", (data: any) => {
      if (data?.venues) setVenues(data.venues);
      if (data?.currentEvent?.title) setCurrentEventTitle(data.currentEvent.title);
      if (data?.voiceSession?.active) setVoiceActive(data.voiceSession.active);
      setLastSyncTime(new Date().toLocaleTimeString());
    });

    // 2. Realtime Display and Venue Listeners
    socket.on("smart-boards-updated", (data: { boards: DisplayInfo[] }) => {
      if (data?.boards) {
        setDisplays(data.boards);
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    });

    socket.on("DISPLAY_CONNECTED", (data: { display: DisplayInfo }) => {
      if (data?.display) {
        setDisplays((prev) => [
          ...prev.filter((d) => d.socketId !== data.display.socketId),
          data.display,
        ]);
        setVenues((prev) =>
          prev.map((v) =>
            v.venueCode === data.display.venueCode
              ? { ...v, status: "ONLINE", updatedAt: new Date().toISOString() }
              : v
          )
        );
      }
    });

    socket.on("DISPLAY_DISCONNECTED", (data: { socketId: string; display?: DisplayInfo }) => {
      setDisplays((prev) => prev.filter((d) => d.socketId !== data.socketId));
    });

    socket.on("VENUE_UPDATED", (data: { venueCode: string; status: "ONLINE" | "OFFLINE" }) => {
      setVenues((prev) =>
        prev.map((v) =>
          v.venueCode === data.venueCode
            ? { ...v, status: data.status, updatedAt: new Date().toISOString() }
            : v
        )
      );
    });

    socket.on("VOICE_STARTED", () => setVoiceActive(true));
    socket.on("VOICE_ENDED", () => setVoiceActive(false));

    return () => {
      socket.off("smart-boards-updated");
      socket.off("DISPLAY_CONNECTED");
      socket.off("DISPLAY_DISCONNECTED");
      socket.off("VENUE_UPDATED");
      socket.off("VOICE_STARTED");
      socket.off("VOICE_ENDED");
    };
  }, []);

  // Compute metrics
  const totalVenues = venues.length || 13;
  const onlineVenues = venues.filter((v) => {
    const hasActiveDisplay = displays.some(
      (d) => d.venueCode === v.venueCode && d.status === "CONNECTED"
    );
    return hasActiveDisplay || v.status === "ONLINE";
  }).length;
  const totalDisplaysConnected = displays.filter((d) => d.status === "CONNECTED").length;

  // Filtered venues list
  const filteredVenues = venues
    .filter((v) => {
      const isOnline =
        v.status === "ONLINE" ||
        displays.some((d) => d.venueCode === v.venueCode && d.status === "CONNECTED");
      if (filter === "ONLINE") return isOnline;
      if (filter === "OFFLINE") return !isOnline;
      return true;
    })
    .filter((v) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        v.venueCode.toLowerCase().includes(q) ||
        v.venueName.toLowerCase().includes(q) ||
        (v.trackName && v.trackName.toLowerCase().includes(q))
      );
    });

  return (
    <div className="flex min-h-screen bg-dark text-white select-none">
      <AdminSidebar />

      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-dark-border mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Monitor className="w-6 h-6 text-neon-green" />
              <h1 className="text-2xl font-black tracking-widest uppercase text-white">
                VENUE & END SCREEN MONITOR
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Authoritative deployment telemetry for all 13 physical venues & Smart Board clients
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshAllUserViews}
              disabled={refreshingAll}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-mono text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(0,243,255,0.2)] disabled:opacity-50"
              title="Send instant refresh command to all 13 venue displays"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAll ? "animate-spin" : ""}`} />
              <span>{refreshingAll ? "REFRESHING..." : "REFRESH ALL USER SCREENS"}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400">LAST SYNC:</span>
              <span className="text-neon-cyan font-bold">{lastSyncTime}</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neon-green/10 border border-neon-green/30 font-mono text-xs text-neon-green font-bold">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span>REALTIME PERSISTENT</span>
            </div>
          </div>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-2xl bg-dark-panel border border-dark-border">
            <div className="text-xs font-mono uppercase text-gray-400 mb-1 flex items-center justify-between">
              <span>PHYSICAL VENUES</span>
              <Layers className="w-4 h-4 text-neon-cyan" />
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {onlineVenues} <span className="text-sm text-gray-500 font-normal">/ {totalVenues} ONLINE</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-2 font-mono">
              {totalVenues - onlineVenues === 0
                ? "All 13 locations operational"
                : `${totalVenues - onlineVenues} venue(s) waiting for display`}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-dark-panel border border-dark-border">
            <div className="text-xs font-mono uppercase text-gray-400 mb-1 flex items-center justify-between">
              <span>CONNECTED DISPLAYS</span>
              <Tv className="w-4 h-4 text-neon-green" />
            </div>
            <div className="text-3xl font-black text-neon-green font-mono">
              {totalDisplaysConnected}
            </div>
            <div className="text-[11px] text-gray-400 mt-2 font-mono">
              Active Smart Board TV receivers
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-dark-panel border border-dark-border">
            <div className="text-xs font-mono uppercase text-gray-400 mb-1 flex items-center justify-between">
              <span>CENTRAL VOICE SFU</span>
              <Radio className={`w-4 h-4 ${voiceActive ? "text-red-500 animate-pulse" : "text-gray-500"}`} />
            </div>
            <div className={`text-2xl font-black font-mono ${voiceActive ? "text-red-400" : "text-gray-400"}`}>
              {voiceActive ? "● BROADCASTING" : "STANDBY"}
            </div>
            <div className="text-[11px] text-gray-400 mt-2 font-mono">
              WebRTC Opus low-latency channel
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-dark-panel border border-dark-border">
            <div className="text-xs font-mono uppercase text-gray-400 mb-1 flex items-center justify-between">
              <span>ACTIVE STAGE PHASE</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-base font-bold text-gray-200 truncate font-mono">
              {currentEventTitle}
            </div>
            <div className="text-[11px] text-gray-400 mt-2 font-mono">
              Synchronized on all screens
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-dark p-1 rounded-xl border border-dark-border w-full sm:w-auto">
            {(["ALL", "ONLINE", "OFFLINE"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                  filter === tab
                    ? "bg-neon-green text-dark shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab} {tab === "ONLINE" && `(${onlineVenues})`} {tab === "OFFLINE" && `(${totalVenues - onlineVenues})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by venue or track..."
              className="w-full bg-dark border border-dark-border rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-neon-green"
            />
          </div>
        </div>

        {/* 13 Venues Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((v) => {
            const venueDisplays = displays.filter(
              (d) => d.venueCode === v.venueCode && d.status === "CONNECTED"
            );
            const isOnline = venueDisplays.length > 0 || v.status === "ONLINE";

            return (
              <div
                key={v.id || v.venueCode}
                className={`rounded-2xl border p-6 flex flex-col justify-between transition-all shadow-xl relative overflow-hidden ${
                  isOnline
                    ? "bg-dark-panel/90 border-emerald-500/40 hover:border-neon-green shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                    : "bg-dark-panel/40 border-dark-border hover:border-white/20"
                }`}
              >
                {/* Accent top stripe */}
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${
                    isOnline
                      ? "bg-gradient-to-r from-neon-green via-neon-cyan to-neon-green"
                      : "bg-gray-700"
                  }`}
                />

                {/* Venue Header */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-black text-sm text-neon-cyan tracking-wider">
                      {v.venueCode}
                    </span>

                    {/* Status Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isOnline
                          ? "bg-neon-green/20 text-neon-green border border-neon-green/40 shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? "bg-neon-green animate-pulse" : "bg-red-500"
                        }`}
                      />
                      <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">
                    {v.venueName}
                  </h3>

                  <div className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-4">
                    {v.trackName || "GENERAL HACKATHON TRACK"}
                  </div>
                </div>

                {/* Display Connections Under Venue */}
                <div className="pt-4 border-t border-dark-border mt-3">
                  <div className="flex items-center justify-between mb-2 text-xs font-mono text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-gray-400" />
                      <span>CONNECTED DISPLAYS:</span>
                    </span>
                    <span className={`font-bold ${isOnline ? "text-neon-green" : "text-gray-500"}`}>
                      {venueDisplays.length} DISPLAY{venueDisplays.length !== 1 ? "S" : ""}
                    </span>
                  </div>

                  {venueDisplays.length > 0 ? (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {venueDisplays.map((disp) => (
                        <div
                          key={disp.socketId}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-gray-300"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                            <span className="font-bold text-white">{disp.displayId}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {disp.metadata?.resolution || "1080p / 60Hz"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-black/20 border border-dashed border-white/10 text-center font-mono text-[11px] text-gray-500 italic">
                      No active screen connected
                    </div>
                  )}

                  {/* Telemetry Footer */}
                  <div className="flex items-center justify-between mt-4 text-[10px] font-mono text-gray-500 pt-2 border-t border-white/5">
                    <span>
                      VOICE: {voiceActive ? (isOnline ? "STREAMING" : "WAITING") : "STANDBY"}
                    </span>
                    <span>
                      SCREEN: {isOnline ? "COUNTDOWN LIVE" : "STANDBY"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
