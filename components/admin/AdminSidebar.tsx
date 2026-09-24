"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Radio, Bell, LayoutDashboard, Monitor, LogOut, Calendar } from "lucide-react";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Central Voice", href: "/admin/voice", icon: Radio },
    { label: "Alert Centre", href: "/admin/alerts", icon: Bell },
    { label: "Venue Monitor (13)", href: "/admin/live-monitor", icon: Monitor },
    { label: "Display & Schedule", href: "/admin/schedule", icon: Calendar },
  ];

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    router.push("/admin/login");
  };

  return (
    <aside className="w-64 bg-dark-panel border-r border-dark-border min-h-screen p-6 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Hack The Horizon" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-sm font-black text-neon-green tracking-widest uppercase">
              HTH 2.0
            </h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
              Command Centre
            </p>
          </div>
        </div>

        {/* System Status Indicator */}
        <div className="mb-6 p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
          <span className="text-[11px] font-mono text-gray-400">CORE SYSTEM</span>
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-neon-green">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            ONLINE
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-neon-green text-dark font-bold shadow-[0_0_15px_rgba(57,255,20,0.3)]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-dark" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="pt-6 border-t border-dark-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit Portal</span>
        </button>
      </div>
    </aside>
  );
}
