"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("admin_token", data.token);
        localStorage.setItem("admin_email", data.user?.email || email);
        router.push("/admin/dashboard");
      } else {
        setError(data.error || "Authentication failed.");
      }
    } catch (err) {
      setError("Unable to connect to authentication service.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black/40">
      <div className="bg-dark-panel border border-dark-border p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-neon-green/5 blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-center mb-6 relative z-10">
          <img src="/logo.png" alt="Hack The Horizon Logo" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-gray-500 text-center mb-8 text-sm uppercase tracking-widest relative z-10">Admin Authentication</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4 relative z-10">
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2 block">Email / Username</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-green focus:shadow-[0_0_10px_rgba(57,255,20,0.2)] transition-all"
              placeholder="admin@hth.com"
              required
            />
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-green focus:shadow-[0_0_10px_rgba(57,255,20,0.2)] transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="text-red-500 text-sm font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}

          <button
            type="submit"
            className="w-full bg-neon-green text-dark font-black tracking-widest uppercase py-4 rounded-lg mt-4 hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all active:scale-[0.98]"
          >
            Access System
          </button>
        </form>
      </div>
    </main>
  );
}
