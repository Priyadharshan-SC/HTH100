"use client";

import { useState } from "react";
import { AlertType } from "./OmnitrixAlertOverlay";
import { X, Image as ImageIcon } from "lucide-react";

interface AlertCentreFeedProps {
  alerts: AlertType[];
}

export default function AlertCentreFeed({ alerts }: AlertCentreFeedProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center max-w-md w-full">
        <div className="text-gray-400 font-mono text-xs uppercase tracking-widest mb-1">
          ALERT CENTRE
        </div>
        <div className="text-gray-500 text-sm italic">
          No active broadcast alerts.
        </div>
      </div>
    );
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "URGENT":
        return {
          dot: "bg-red-500",
          border: "border-red-500/40",
          tag: "text-red-400 border-red-500/30",
        };
      case "WARNING":
        return {
          dot: "bg-yellow-400",
          border: "border-yellow-400/40",
          tag: "text-yellow-400 border-yellow-400/30",
        };
      case "SUCCESS":
        return {
          dot: "bg-neon-green",
          border: "border-neon-green/40",
          tag: "text-neon-green border-neon-green/30",
        };
      case "INFO":
      default:
        return {
          dot: "bg-neon-cyan",
          border: "border-neon-cyan/40",
          tag: "text-neon-cyan border-neon-cyan/30",
        };
    }
  };

  return (
    <>
      <div className="w-full max-w-md flex flex-col bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            <h3 className="font-mono font-bold tracking-[0.25em] uppercase text-xs text-white">
              ALERT CENTRE
            </h3>
          </div>
          <span className="font-mono text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded">
            {alerts.length} {alerts.length === 1 ? "ALERT" : "ALERTS"}
          </span>
        </div>

        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
          {alerts.slice(0, 5).map((alert) => {
            const style = getTypeStyle(alert.type);
            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl bg-white/[0.03] border ${style.border} transition-all hover:bg-white/[0.06]`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className="font-black text-sm text-white uppercase tracking-wide">
                      {alert.title}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-gray-400">
                    {new Date(alert.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className={`text-xs text-gray-300 font-medium ${alert.imageUrl ? "mb-2" : "line-clamp-2"}`}>
                  {alert.message}
                </p>

                {alert.imageUrl && (
                  <div 
                    onClick={() => setSelectedImage(alert.imageUrl!)}
                    className="mt-2 relative rounded-lg overflow-hidden border border-white/15 bg-black/60 group cursor-pointer max-h-40 flex items-center justify-center"
                  >
                    <img
                      src={alert.imageUrl}
                      alt={alert.title}
                      className="w-full max-h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-[11px] font-mono font-bold text-white bg-black/60 backdrop-blur-xs">
                      <ImageIcon className="w-3.5 h-3.5 text-neon-green" />
                      <span>Click to enlarge</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Enlarged Image Modal */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-dark-panel border border-white/20 rounded-2xl p-2 shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 bg-black/70 hover:bg-black text-white p-2 rounded-full border border-white/20 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImage}
              alt="Enlarged alert photo"
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </>
  );
}

