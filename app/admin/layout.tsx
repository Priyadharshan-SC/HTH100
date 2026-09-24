import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Hack The Horizon",
  description: "Control Centre Administration",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-white font-sans">
      {children}
    </div>
  );
}
