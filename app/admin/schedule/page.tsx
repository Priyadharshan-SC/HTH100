"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getSocket } from "@/lib/socket";
import {
  Calendar,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Eye,
  Clock,
  Sparkles,
  Save,
  Tv,
} from "lucide-react";

export interface DisplayConfigType {
  showCountdown: boolean;
  showSchedule: boolean;
  showAlertCentre: boolean;
  showLogo: boolean;
  customAnnouncement: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  priority: number;
}

export default function AdminSchedulePage() {
  const [config, setConfig] = useState<DisplayConfigType>({
    showCountdown: true,
    showSchedule: true,
    showAlertCentre: true,
    showLogo: true,
    customAnnouncement: "",
  });
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  // New Event Form State
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventPriority, setEventPriority] = useState(1);
  const [eventStatus, setEventStatus] = useState("UPCOMING");

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/display-config");
      const data = await res.json();
      if (data.config) setConfig(data.config);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchEvents();

    const socket = getSocket();
    const handleSync = () => {
      fetchConfig();
      fetchEvents();
    };

    socket.on("DISPLAY_CONFIG_UPDATED", handleSync);
    socket.on("EVENT_CREATED", handleSync);
    socket.on("EVENT_UPDATED", handleSync);
    socket.on("EVENT_DELETED", handleSync);
    socket.on("SCHEDULE_UPDATED", handleSync);

    return () => {
      socket.off("DISPLAY_CONFIG_UPDATED", handleSync);
      socket.off("EVENT_CREATED", handleSync);
      socket.off("EVENT_UPDATED", handleSync);
      socket.off("EVENT_DELETED", handleSync);
      socket.off("SCHEDULE_UPDATED", handleSync);
    };
  }, []);

  const handleSaveConfig = async (newConfig: DisplayConfigType) => {
    try {
      setSavingConfig(true);
      setConfig(newConfig);
      await fetch("/api/display-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
    } catch (e) {
      console.error("Failed to update display settings:", e);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggle = (key: keyof Omit<DisplayConfigType, "customAnnouncement">) => {
    const updated = { ...config, [key]: !config[key] };
    handleSaveConfig(updated);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: eventTitle,
        description: eventDesc,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        priority: eventPriority,
        status: eventStatus,
      };

      if (editingEvent) {
        await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEvent.id, ...payload }),
        });
      } else {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setShowEventModal(false);
      setEditingEvent(null);
      setEventTitle("");
      setEventDesc("");
      setStartTime("");
      setEndTime("");
      fetchEvents();
    } catch (err) {
      console.error("Failed to save event:", err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule item?")) return;
    try {
      await fetch(`/api/events?id=${id}`, { method: "DELETE" });
      fetchEvents();
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setEventTitle("");
    setEventDesc("");
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setStartTime(now.toISOString().slice(0, 16));
    setEndTime(later.toISOString().slice(0, 16));
    setEventPriority(1);
    setEventStatus("UPCOMING");
    setShowEventModal(true);
  };

  const openEditModal = (evt: ScheduleEvent) => {
    setEditingEvent(evt);
    setEventTitle(evt.title);
    setEventDesc(evt.description || "");
    setStartTime(new Date(evt.startTime).toISOString().slice(0, 16));
    setEndTime(new Date(evt.endTime).toISOString().slice(0, 16));
    setEventPriority(evt.priority || 1);
    setEventStatus(evt.status || "UPCOMING");
    setShowEventModal(true);
  };

  return (
    <div className="flex min-h-screen bg-dark text-white select-none">
      <AdminSidebar />

      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-dark-border mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-neon-green" />
              <h1 className="text-2xl font-black tracking-widest uppercase text-white">
                SCHEDULE & LIVE DISPLAY CONTROL
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Configure event timeline and control End Screen component visibility in real time
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-green text-dark font-black text-xs uppercase tracking-wider hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>NEW SCHEDULE EVENT</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: LIVE DISPLAY CONFIGURATION (TOGGLES) */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 mb-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-yellow-400" />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                <Sliders className="w-5 h-5 text-neon-green" />
                <span>LIVE DISPLAY COMPONENT VISIBILITY</span>
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Toggle display elements across all 13 venues — changes propagate immediately without refresh
              </p>
            </div>

            {savingConfig && (
              <span className="text-xs font-mono text-neon-green animate-pulse">
                SYNCING TO ALL SCREENS...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Toggle: Countdown */}
            <div
              onClick={() => handleToggle("showCountdown")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                config.showCountdown
                  ? "bg-neon-green/10 border-neon-green/40 shadow-[0_0_15px_rgba(57,255,20,0.15)]"
                  : "bg-black/40 border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              <div>
                <div className="font-mono font-bold text-xs uppercase text-white mb-0.5">
                  EVENT COUNTDOWN
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {config.showCountdown ? "VISIBLE ON SCREENS" : "HIDDEN"}
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full flex items-center p-1 transition-all ${
                  config.showCountdown ? "bg-neon-green justify-end" : "bg-gray-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow" />
              </div>
            </div>

            {/* Toggle: Schedule */}
            <div
              onClick={() => handleToggle("showSchedule")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                config.showSchedule
                  ? "bg-neon-cyan/10 border-neon-cyan/40 shadow-[0_0_15px_rgba(0,243,255,0.15)]"
                  : "bg-black/40 border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              <div>
                <div className="font-mono font-bold text-xs uppercase text-white mb-0.5">
                  EVENT INFO / PHASE
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {config.showSchedule ? "VISIBLE ON SCREENS" : "HIDDEN"}
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full flex items-center p-1 transition-all ${
                  config.showSchedule ? "bg-neon-cyan justify-end" : "bg-gray-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow" />
              </div>
            </div>

            {/* Toggle: Alert Centre */}
            <div
              onClick={() => handleToggle("showAlertCentre")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                config.showAlertCentre
                  ? "bg-yellow-400/10 border-yellow-400/40 shadow-[0_0_15px_rgba(250,204,21,0.15)]"
                  : "bg-black/40 border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              <div>
                <div className="font-mono font-bold text-xs uppercase text-white mb-0.5">
                  ALERT CENTRE FEED
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {config.showAlertCentre ? "VISIBLE ON SCREENS" : "HIDDEN"}
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full flex items-center p-1 transition-all ${
                  config.showAlertCentre ? "bg-yellow-400 justify-end" : "bg-gray-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow" />
              </div>
            </div>

            {/* Toggle: Logos */}
            <div
              onClick={() => handleToggle("showLogo")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                config.showLogo
                  ? "bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "bg-black/40 border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              <div>
                <div className="font-mono font-bold text-xs uppercase text-white mb-0.5">
                  BRANDING & LOGOS
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {config.showLogo ? "VISIBLE ON SCREENS" : "HIDDEN"}
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full flex items-center p-1 transition-all ${
                  config.showLogo ? "bg-purple-500 justify-end" : "bg-gray-700 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow" />
              </div>
            </div>
          </div>

          {/* Custom Announcement Ticker Input */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase text-neon-green whitespace-nowrap">
              LIVE TICKER / ANNOUNCEMENT:
            </span>
            <input
              type="text"
              value={config.customAnnouncement || ""}
              onChange={(e) => setConfig({ ...config, customAnnouncement: e.target.value })}
              placeholder="e.g. Wi-Fi SSID: HackTheHorizon_5G | Password: Horizon2026 | Mentors available at Lab Block A"
              className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-green font-mono"
            />
            <button
              onClick={() => handleSaveConfig(config)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-green/20 border border-neon-green text-neon-green font-mono text-xs font-bold uppercase hover:bg-neon-green hover:text-black transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>PUBLISH TICKER</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: SCHEDULE TIMELINE MANAGEMENT */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-6 border-b border-dark-border mb-6">
            <div>
              <h2 className="text-lg font-black tracking-widest uppercase">
                SCHEDULE TIMELINE MATRIX
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Active timeline of hackathon milestones synced with countdown engine
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {events.length === 0 ? (
              <div className="p-8 text-center font-mono text-sm text-gray-500 italic border border-dashed border-dark-border rounded-xl">
                No events currently configured. Click "New Schedule Event" above to create one.
              </div>
            ) : (
              events.map((evt) => {
                const now = new Date();
                const start = new Date(evt.startTime);
                const end = new Date(evt.endTime);
                const isLive = now >= start && now < end;
                const isPast = now >= end;

                return (
                  <div
                    key={evt.id}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      isLive
                        ? "bg-neon-green/5 border-neon-green/40 shadow-[0_0_20px_rgba(57,255,20,0.1)]"
                        : "bg-black/30 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start md:items-center gap-4">
                      <div
                        className={`w-3 h-3 rounded-full mt-1 md:mt-0 ${
                          isLive
                            ? "bg-neon-green animate-pulse shadow-[0_0_8px_#39ff14]"
                            : isPast
                            ? "bg-gray-600"
                            : "bg-neon-cyan"
                        }`}
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base uppercase">
                            {evt.title}
                          </h3>
                          {isLive && (
                            <span className="px-2.5 py-0.5 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/40 text-[10px] font-mono font-bold uppercase animate-pulse">
                              LIVE NOW
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{evt.description}</p>
                        )}

                        <div className="text-xs font-mono text-gray-400 mt-1 flex items-center gap-3">
                          <span>
                            START: {new Date(evt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>•</span>
                          <span>
                            END: {new Date(evt.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        onClick={() => openEditModal(evt)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        title="Edit event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal: Create / Edit Event */}
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
              <h2 className="text-lg font-black uppercase tracking-wider mb-4">
                {editingEvent ? "EDIT SCHEDULE EVENT" : "CREATE SCHEDULE EVENT"}
              </h2>

              <form onSubmit={handleSaveEvent} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                    Event Title
                  </label>
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g. Round 2 — Project Demo"
                    className="w-full bg-dark border border-dark-border rounded-xl p-3 text-sm text-white focus:outline-none focus:border-neon-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                    Description / Subtitle
                  </label>
                  <input
                    type="text"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    placeholder="e.g. Teams present their prototypes to jury"
                    className="w-full bg-dark border border-dark-border rounded-xl p-3 text-sm text-white focus:outline-none focus:border-neon-green"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-dark border border-dark-border rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-neon-green"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-dark border border-dark-border rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-dark-border">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-mono uppercase text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-neon-green text-dark font-black text-xs uppercase tracking-wider hover:shadow-[0_0_15px_rgba(57,255,20,0.4)] transition-all"
                  >
                    {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
