"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import OmnitrixAlertOverlay, { AlertType } from "@/components/OmnitrixAlertOverlay";
import { getSocket } from "@/lib/socket";
import { Bell, Eye, Send, Edit3, Trash2, Search, Filter, AlertTriangle, Image as ImageIcon, Upload, X } from "lucide-react";

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [type, setType] = useState<"INFO" | "SUCCESS" | "WARNING" | "URGENT">("INFO");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [duration, setDuration] = useState("15");
  const [targetType, setTargetType] = useState<"ALL" | "VENUE" | "DISPLAY">("ALL");
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [targetDisplay, setTargetDisplay] = useState<string>("VENUE-01:DISPLAY-01");

  const ALL_VENUES = [
    { code: "VENUE-01", name: "Main Auditorium" },
    { code: "VENUE-02", name: "Seminar Hall A" },
    { code: "VENUE-03", name: "Seminar Hall B" },
    { code: "VENUE-04", name: "Computing Lab 1" },
    { code: "VENUE-05", name: "Computing Lab 2" },
    { code: "VENUE-06", name: "AI & Robotics Centre" },
    { code: "VENUE-07", name: "IoT Innovation Hub" },
    { code: "VENUE-08", name: "Cybersecurity Lab" },
    { code: "VENUE-09", name: "Design Thinking Lab" },
    { code: "VENUE-10", name: "Incubation Gallery" },
    { code: "VENUE-11", name: "Presentation Hall 1" },
    { code: "VENUE-12", name: "Presentation Hall 2" },
    { code: "VENUE-13", name: "Executive Boardroom" },
  ];

  // Filtering & Search
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Preview Modal
  const [previewAlert, setPreviewAlert] = useState<AlertType | null>(null);

  // Edit Modal
  const [editingAlert, setEditingAlert] = useState<any | null>(null);

  // Delete Confirmation Modal
  const [deleteTargetAlert, setDeleteTargetAlert] = useState<any | null>(null);

  // Fetch alerts log
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/alerts", window.location.origin);
      if (selectedTypeFilter !== "ALL") url.searchParams.set("type", selectedTypeFilter);
      if (searchQuery.trim()) url.searchParams.set("search", searchQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Auto-refresh alerts log in background without requiring manual reload
    const interval = setInterval(() => {
      const url = new URL("/api/alerts", window.location.origin);
      if (selectedTypeFilter !== "ALL") url.searchParams.set("type", selectedTypeFilter);
      if (searchQuery.trim()) url.searchParams.set("search", searchQuery.trim());
      fetch(url.toString())
        .then((res) => res.json())
        .then((data) => {
          if (data?.alerts) setAlerts(data.alerts);
        })
        .catch(() => {});
    }, 4000);

    const socket = getSocket();
    const handleSync = () => {
      fetchAlerts();
    };

    socket.on("ALERT_CREATED", handleSync);
    socket.on("ALERT_UPDATED", handleSync);
    socket.on("ALERT_DELETED", handleSync);
    socket.on("ALERT_BROADCASTED", handleSync);

    return () => {
      clearInterval(interval);
      socket.off("ALERT_CREATED", handleSync);
      socket.off("ALERT_UPDATED", handleSync);
      socket.off("ALERT_DELETED", handleSync);
      socket.off("ALERT_BROADCASTED", handleSync);
    };
  }, [selectedTypeFilter]);

  // Handle Create & Broadcast
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    const newAlert = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      priority,
      duration: parseInt(duration, 10) || 15,
      targetType,
      targetVenues: targetType === "VENUE" ? selectedVenues : "ALL",
      targetDisplay: targetType === "DISPLAY" ? targetDisplay : undefined,
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/alerts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAlert),
      });

      if (res.ok) {
        setTitle("");
        setMessage("");
        setImageUrl("");
        fetchAlerts();
        alert(`Alert broadcasted successfully [Target: ${targetType}]!`);
      }
    } catch (err) {
      console.error(err);
      alert("Error broadcasting alert.");
    }
  };

  // Handle Trigger Preview
  const handleTriggerPreview = () => {
    if (!title.trim()) {
      alert("Please enter a title to preview the alert.");
      return;
    }
    const alertData: AlertType = {
      id: "preview-" + Date.now(),
      title,
      message: message || "Sample message for alert preview demonstration.",
      type,
      priority,
      duration: parseInt(duration, 10) || 15,
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setPreviewAlert(alertData);
  };

  // Handle Save Edited Alert
  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    try {
      const res = await fetch(`/api/alerts/${editingAlert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingAlert),
      });

      if (res.ok) {
        setEditingAlert(null);
        fetchAlerts();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update alert.");
    }
  };

  // Handle Confirm Delete Alert
  const handleConfirmDelete = async () => {
    if (!deleteTargetAlert) return;
    try {
      const res = await fetch(`/api/alerts/${deleteTargetAlert.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteTargetAlert(null);
        fetchAlerts();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete alert.");
    }
  };

  // Rebroadcast an existing alert from the log
  const handleRebroadcastExisting = async (existingAlert: any) => {
    try {
      const res = await fetch("/api/alerts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...existingAlert,
          createdAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        alert(`Rebroadcasted "${existingAlert.title}" to all Smart Boards!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeBadge = (alertType: string) => {
    switch (alertType) {
      case "URGENT":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      case "WARNING":
        return "bg-yellow-400/20 text-yellow-400 border-yellow-400/40";
      case "SUCCESS":
        return "bg-neon-green/20 text-neon-green border-neon-green/40";
      case "INFO":
      default:
        return "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40";
    }
  };

  return (
    <div className="flex min-h-screen bg-dark text-white select-none">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Interactive Alert Preview Overlay */}
      {previewAlert && (
        <OmnitrixAlertOverlay
          previewAlert={previewAlert}
          onPreviewClose={() => setPreviewAlert(null)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-dark-border mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-neon-green" />
              <h1 className="text-2xl font-black tracking-widest uppercase text-white">
                ALERT OPERATIONS CENTRE
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Create, preview, broadcast, and manage emergency notifications for Smart Boards
            </p>
          </div>
        </div>

        {/* Top Section: Create & Broadcast Form */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 mb-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-yellow-400" />

          <h2 className="text-lg font-black tracking-widest uppercase mb-6 flex items-center gap-2">
            <span>CREATE & BROADCAST ALERT</span>
          </h2>

          <form onSubmit={handleBroadcast} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-mono font-bold uppercase text-gray-400 mb-2 block">
                  Alert Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Submission Checkpoint"
                  className="w-full bg-dark border border-dark-border rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-neon-green font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-mono font-bold uppercase text-gray-400 mb-2 block">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full bg-dark border border-dark-border rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-neon-green"
                  >
                    <option value="INFO">INFO</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="WARNING">WARNING</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-gray-400 mb-2 block">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-dark border border-dark-border rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-neon-green"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH (Urgent Jump)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-gray-400 mb-2 block">
                    Duration (Sec)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-dark border border-dark-border rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-neon-green font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Target Audience Selector (All Venues, Specific Venues, Specific Display) */}
            <div className="p-4 rounded-xl bg-black/40 border border-dark-border">
              <label className="text-xs font-mono font-bold uppercase text-neon-green mb-3 block flex items-center justify-between">
                <span>TARGET AUDIENCE SELECTION</span>
                <span className="text-[10px] text-gray-400 font-normal">
                  Server-side audience targeted delivery
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono font-bold">
                  <input
                    type="radio"
                    name="targetType"
                    value="ALL"
                    checked={targetType === "ALL"}
                    onChange={() => setTargetType("ALL")}
                    className="accent-neon-green"
                  />
                  <span>ALL 13 VENUES (GLOBAL)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono font-bold">
                  <input
                    type="radio"
                    name="targetType"
                    value="VENUE"
                    checked={targetType === "VENUE"}
                    onChange={() => setTargetType("VENUE")}
                    className="accent-neon-green"
                  />
                  <span>SELECTED VENUES</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono font-bold">
                  <input
                    type="radio"
                    name="targetType"
                    value="DISPLAY"
                    checked={targetType === "DISPLAY"}
                    onChange={() => setTargetType("DISPLAY")}
                    className="accent-neon-green"
                  />
                  <span>SPECIFIC DISPLAY</span>
                </label>
              </div>

              {/* Specific Venue Multiselect Grid */}
              {targetType === "VENUE" && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-[11px] font-mono text-gray-300 mb-2">
                    Check the venues that should display this alert:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {ALL_VENUES.map((v) => {
                      const isChecked = selectedVenues.includes(v.code);
                      return (
                        <button
                          type="button"
                          key={v.code}
                          onClick={() => {
                            setSelectedVenues((prev) =>
                              isChecked
                                ? prev.filter((c) => c !== v.code)
                                : [...prev, v.code]
                            );
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-mono transition-all ${
                            isChecked
                              ? "bg-neon-green/20 border-neon-green text-neon-green font-bold"
                              : "bg-black/20 border-white/10 text-gray-400 hover:border-white/30"
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded flex items-center justify-center text-[9px] border ${
                              isChecked
                                ? "bg-neon-green border-neon-green text-black font-black"
                                : "border-gray-500"
                            }`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className="truncate">
                            {v.code} ({v.name})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Specific Display selector */}
              {targetType === "DISPLAY" && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-300">
                    Display Identifier:
                  </span>
                  <input
                    type="text"
                    value={targetDisplay}
                    onChange={(e) => setTargetDisplay(e.target.value)}
                    placeholder="e.g. VENUE-01:DISPLAY-01"
                    className="bg-dark border border-dark-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-neon-green focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-mono font-bold uppercase text-gray-400 mb-2 block">
                Alert Message
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. All teams must push their code and submit before 6:00 PM sharp."
                className="w-full bg-dark border border-dark-border rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-neon-green min-h-[90px] font-medium"
              />
            </div>

            {/* Optional Photo Attachment */}
            <div className="p-4 rounded-xl bg-black/40 border border-dark-border">
              <label className="text-xs font-mono font-bold uppercase text-gray-300 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-neon-green" />
                  <span>ATTACH PHOTO / POSTER (OPTIONAL)</span>
                </span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-[11px] text-red-400 hover:text-red-300 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Remove Photo
                  </button>
                )}
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-dark border border-dashed border-dark-border hover:border-neon-green rounded-xl text-xs font-mono text-gray-300 hover:text-white transition-all w-full sm:w-auto shrink-0 shadow-sm">
                  <Upload className="w-4 h-4 text-neon-green" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert("Photo file is too large! Please choose an image smaller than 5MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImageUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                <span className="text-xs text-gray-500 font-mono">OR</span>

                <input
                  type="url"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste direct image link: https://example.com/banner.jpg"
                  className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-neon-green"
                />
              </div>

              {imageUrl && (
                <div className="mt-4 flex items-center gap-4 p-3 bg-dark/60 rounded-xl border border-neon-green/30">
                  <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-white/20 bg-black shrink-0">
                    <img
                      src={imageUrl}
                      alt="Alert preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-neon-green flex items-center gap-1.5">
                      <span>✓ Photo Attached</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                      {imageUrl.startsWith("data:") ? "Uploaded local image file" : imageUrl}
                    </p>
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 font-mono underline"
                    >
                      Delete attachment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 pt-2">
              <button
                type="button"
                onClick={handleTriggerPreview}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/20 hover:bg-white/10 font-mono font-bold text-xs uppercase tracking-wider text-gray-300 hover:text-white transition-all"
              >
                <Eye className="w-4 h-4 text-neon-cyan" />
                <span>PREVIEW ACTIVATION</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-neon-green text-dark font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(57,255,20,0.5)] transition-all"
              >
                <Send className="w-4 h-4" />
                <span>BROADCAST NOW</span>
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Section: Alert Log & Management */}
        <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-dark-border gap-4 mb-6">
            <div>
              <h2 className="text-lg font-black tracking-widest uppercase">ALERT LOG</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Audit trail and database history of broadcasted alerts
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-dark p-1 rounded-xl border border-dark-border">
                {["ALL", "INFO", "SUCCESS", "WARNING", "URGENT"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedTypeFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      selectedTypeFilter === f
                        ? "bg-neon-green text-dark shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchAlerts()}
                  className="bg-dark border border-dark-border rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-neon-green"
                />
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Alert Table */}
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-mono text-sm">
              Loading alert logs...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-mono text-sm">
              No matching alerts found in database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-border text-xs text-gray-400 font-mono uppercase">
                    <th className="pb-3 pl-3">Time</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Title & Message</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 pl-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                        {new Date(alert.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold uppercase ${getTypeBadge(
                            alert.type
                          )}`}
                        >
                          {alert.type}
                        </span>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-start gap-3">
                          {alert.imageUrl && (
                            <img
                              src={alert.imageUrl}
                              alt={alert.title}
                              className="w-10 h-10 rounded-lg object-cover border border-white/20 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-white uppercase tracking-wide flex items-center gap-2">
                              <span>{alert.title}</span>
                              {alert.imageUrl && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 font-mono font-normal">
                                  <ImageIcon className="w-3 h-3" /> Photo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-300 font-medium line-clamp-1 mt-0.5">
                              {alert.message}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-xs text-neon-green font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                          {alert.status || "SENT"}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRebroadcastExisting(alert)}
                            className="p-2 rounded-lg bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan transition-colors"
                            title="Rebroadcast to Smart Boards"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingAlert(alert)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                            title="Edit Alert"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetAlert(alert)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            title="Delete Alert"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Alert Modal */}
        {editingAlert && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-dark-panel border border-dark-border rounded-2xl p-6 max-w-lg w-full shadow-2xl">
              <h3 className="text-lg font-black uppercase mb-4 text-white">Modify Alert</h3>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editingAlert.title}
                    onChange={(e) => setEditingAlert({ ...editingAlert, title: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                    Message
                  </label>
                  <textarea
                    value={editingAlert.message}
                    onChange={(e) => setEditingAlert({ ...editingAlert, message: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                      Type
                    </label>
                    <select
                      value={editingAlert.type}
                      onChange={(e) => setEditingAlert({ ...editingAlert, type: e.target.value })}
                      className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm"
                    >
                      <option value="INFO">INFO</option>
                      <option value="SUCCESS">SUCCESS</option>
                      <option value="WARNING">WARNING</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                      Duration (Sec)
                    </label>
                    <input
                      type="number"
                      value={editingAlert.duration}
                      onChange={(e) => setEditingAlert({ ...editingAlert, duration: e.target.value })}
                      className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase text-gray-400 block mb-1">
                    Photo Attachment URL / File
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingAlert.imageUrl || ""}
                      onChange={(e) => setEditingAlert({ ...editingAlert, imageUrl: e.target.value })}
                      placeholder="Paste image link or upload"
                      className="w-full bg-dark border border-dark-border rounded-xl p-3 text-white text-xs font-mono"
                    />
                    <label className="cursor-pointer px-3 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-mono flex items-center gap-1 shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditingAlert({ ...editingAlert, imageUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {editingAlert.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditingAlert({ ...editingAlert, imageUrl: "" })}
                        className="px-3 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-mono whitespace-nowrap"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editingAlert.imageUrl && (
                    <div className="mt-2 w-28 h-20 rounded-lg overflow-hidden border border-white/20 bg-black">
                      <img
                        src={editingAlert.imageUrl}
                        alt="Edit preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    onClick={() => setEditingAlert(null)}
                    className="px-4 py-2 rounded-xl text-xs font-mono text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-6 py-2 rounded-xl bg-neon-green text-dark font-bold text-xs uppercase"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTargetAlert && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-dark-panel border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 text-red-400 mb-3">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-black uppercase">Delete this alert?</h3>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed mb-6">
                Are you sure you want to permanently delete "{deleteTargetAlert.title}" from the database alert log?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteTargetAlert(null)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider"
                >
                  Delete Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
