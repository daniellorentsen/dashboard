import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Salgs Dashboard",
  description: "Internt salgs dashboard – Rackbeat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-[#f5f2ee] text-[#1a1410] antialiased">
        {children}
      </body>
    </html>
  );
}
