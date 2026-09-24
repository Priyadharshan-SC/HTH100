import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hack The Horizon 2.0 - Control Centre",
  description: "Official real-time event management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body 
        className={`${inter.className} text-white min-h-screen flex flex-col`}
        style={{ backgroundImage: "url('/Background.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
      >
        {children}
      </body>
    </html>
  );
}
