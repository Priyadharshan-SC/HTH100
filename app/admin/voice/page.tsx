"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import CentralVoicePanel from "@/components/admin/CentralVoicePanel";
import { Radio, Info } from "lucide-react";

export default function AdminVoicePage() {
  return (
    <div className="flex min-h-screen bg-dark text-white select-none">
      <AdminSidebar />

      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        <div className="flex items-center justify-between pb-6 border-b border-dark-border mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-neon-green" />
              <h1 className="text-2xl font-black tracking-widest uppercase text-white">
                CENTRAL VOICE NOTE DISPATCH
              </h1>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Record voice announcements with instant preview and broadcast directly to Smart Board End Screens
            </p>
          </div>
        </div>

        {/* Guidance Alert */}
        <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
          <Info className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-300 leading-relaxed font-sans">
            <strong>Voice Dispatch Protocol:</strong> Record an announcement through your microphone, preview the audio, pick your target venue(s) or broadcast to all 13 venues, and dispatch. The audio instantly transmits to End Screens and triggers the Jarvis overlay.
          </div>
        </div>

        {/* Voice Control Component */}
        <CentralVoicePanel />
      </main>
    </div>
  );
}
