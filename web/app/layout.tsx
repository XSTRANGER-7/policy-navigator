import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CIVIS AI — Trust-Backed Policy Navigator",
  description:
    "AI-powered government scheme eligibility checker with verifiable credentials",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#d9ff00] overflow-x-hidden`}
      >
        <Navbar />
        <div className="mx-0 md:mx-4 mb-4 bg-[#e4e4db] rounded-[40px] border-4 border-black overflow-hidden shadow-[inset_0px_0px_40px_rgba(0,0,0,0.05)]">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
