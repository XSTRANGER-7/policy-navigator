"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Loader from "@/components/Loader";
import Mascot from "@/components/Mascot";
import MarqueeRow from "@/components/MarqueeRow";

export default function Home() {
  const [loading, setLoading] = useState(true);

  if (loading) return <Loader onComplete={() => setLoading(false)} />;

  return (
    <>
      {/* ─── Hero Section ──────────────────────────────── */}
      <section className="relative px-6 pt-16 pb-24 md:px-12 md:pt-24 lg:pt-32 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="flex-1 space-y-10">
            <div className="inline-flex items-center gap-2 bg-[#d9ff00] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
              POLICY NAVIGATOR — GOVTECH AI
            </div>

            <h1 className="text-7xl md:text-[10rem] font-black leading-[0.85] tracking-tighter uppercase text-black">
              EVERYONE <br />
              CAN ACCESS THE <br />
              <span className="text-transparent [-webkit-text-stroke:3px_black] drop-shadow-[6px_6px_0px_rgba(0,0,0,0.1)]">
                BENEFITS.
              </span>
            </h1>

            <p className="text-lg md:text-xl font-bold text-black/60 italic font-mono">
              ** Trust-backed eligibility discovery for all citizens.
            </p>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 pt-4">
              <div className="bg-white border-2 border-black p-4 flex items-center gap-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] rounded-xl w-full md:w-auto">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-400">
                    Powered by
                  </div>
                  <div className="font-black text-xl leading-none italic">
                    AGENT-ZK
                  </div>
                </div>
                <div className="h-8 w-[2px] bg-black/10" />
                <div className="text-xs font-bold text-gray-500">
                  Secure &amp;
                  <br />
                  Transparent
                </div>
              </div>

              <div className="flex gap-4 w-full md:w-auto">
                <Link
                  href="/eligibility"
                  className="flex-1 md:flex-none bg-black text-white px-8 py-4 rounded-full font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform text-center"
                >
                  Check Eligibility
                </Link>
                <Link
                  href="/policies"
                  className="flex-1 md:flex-none bg-white border-2 border-black px-8 py-4 rounded-full font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all text-center"
                >
                  Review Policies
                </Link>
              </div>
            </div>
          </div>

            <div className="lg:pr-12 -translate-y-24 group relative cursor-pointer">
              <img src="/ch.png" alt="Character" className="w-full h-auto scale-300 group-hover:scale-310 transition-transform" />
              
              {/* Popup on hover */}
              <div className="absolute bottom-full right-0 mb-4 bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              <div className="text-black font-black text-center">
                <div className="text-2xl mb-1">PUFFU</div>
                <div className="text-[10px] font-bold italic">Civis AI Agent</div>
                <div className="text-xs mt-2 leading-snug max-w-xs whitespace-normal">
                Your eligibility discovery companion
                </div>
              </div>
              {/* Popup arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[#d9ff00]" />
              </div>
            </div>
        </div>
      </section>

      {/* ─── Role Cards ────────────────────────────────── */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-[10px] font-black uppercase mb-10 text-gray-400 flex items-center gap-4">
          CHOOSE YOUR ROLE <div className="h-[2px] flex-grow bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Citizens */}
          <Link href="/eligibility" className="group">
            <div className="bg-[#d9ff00] border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full rounded-2xl group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              <div className="text-xs font-black opacity-20 mb-4">01</div>
              <h3 className="text-4xl font-black uppercase mb-1">CITIZENS</h3>
              <div className="text-xs font-black italic mb-6">
                discover support
              </div>
              <p className="text-sm font-bold leading-snug mb-8">
                Identify government benefits and social programs you qualify for
                using AI clarity.
              </p>
            </div>
          </Link>

          {/* Agencies */}
          <Link href="/dashboard" className="group">
            <div className="bg-[#ff5c8d] border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full rounded-2xl group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              <div className="text-xs font-black opacity-20 mb-4">02</div>
              <h3 className="text-4xl font-black uppercase mb-1 text-black">
                AGENCIES
              </h3>
              <div className="text-xs font-black italic mb-6">
                verify eligibility
              </div>
              <p className="text-sm font-bold leading-snug mb-8">
                Automate complex verification workflows and prevent fraudulent
                claims with ZK-proofs.
              </p>
            </div>
          </Link>

          {/* NGOs */}
          <Link href="/policies" className="group">
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full rounded-2xl relative pr-16 group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
              <div className="text-xs font-black opacity-20 mb-4">03</div>
              <h3 className="text-4xl font-black uppercase mb-1">NGOs</h3>
              <div className="text-xs font-black italic mb-6">
                scale outreach
              </div>
              <p className="text-sm font-bold leading-snug">
                Bridge the gap between legislative policy and community needs
                without technical overhead.
              </p>
              <div className="absolute right-0 top-0 bottom-0 w-12 border-l-4 border-black flex items-center justify-center bg-white group-hover:bg-[#d9ff00] transition-colors rounded-r-xl">
                <div className="rotate-90 whitespace-nowrap font-black text-[10px] flex items-center gap-2">
                  JOIN CIVIS <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── Dual Marquee ──────────────────────────────── */}
      <div className="border-t-4 border-black">
        <MarqueeRow
          items={[
            "TRUST-BACKED",
            "AGENT-POWERED",
            "VERIFIABLE CREDENTIALS",
            "POLICY DISCOVERY",
            "ZERO KNOWLEDGE",
          ]}
          bg="bg-black"
          text="text-[#d9ff00]"
        />
        <MarqueeRow
          items={[
            "FRAUD PREVENTION",
            "OPEN SOURCE",
            "BUREAUCRACY REDUCTION",
            "PUBLIC GOOD",
            "IDENTITY SOVEREIGNTY",
          ]}
          bg="bg-black"
          text="text-[#ff5c8d]"
          reverse
        />
      </div>

      {/* ─── How It Works ──────────────────────────────── */}
      <section className="bg-zinc-950 text-white py-32 relative">
        <div className="absolute top-0 left-0 right-0 h-24 bg-[#e4e4db] -translate-y-12 -skew-y-2 border-b-4 border-black" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex justify-center mb-24">
        <div className="bg-[#d9ff00] text-black border-4 border-black rounded-full px-12 py-4 -rotate-3 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
          <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter">
            HOW IT WORKS
          </h2>
        </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 items-start">
        <div className="space-y-16">
          <div className="relative">
            <div className="text-[12rem] font-black absolute -top-24 -left-12 opacity-10 pointer-events-none">
          1.
            </div>
            <div className="relative space-y-4">
          <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            DISCOVER &amp; VERIFY <br /> WITH AGENTS
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed max-w-sm">
            Connect your secure credentials. Our agents analyze local
            and national policies to find every benefit you are entitled
            to.
          </p>
          <Link
            href="/eligibility"
            className="inline-block bg-[#d9ff00] text-black font-black uppercase px-10 py-3 rounded-full shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:scale-105 transition-transform"
          >
            View Support
          </Link>
            </div>
          </div>

          <div className="relative">
            <div className="text-[12rem] font-black absolute -top-24 -left-12 opacity-10 pointer-events-none">
          2.
            </div>
            <div className="relative space-y-4">
          <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            NAVIGATE WITHOUT <br /> THE RED TAPE
          </h3>
          <p className="text-gray-400 font-medium leading-relaxed max-w-sm">
            Receive clear, human-readable explanations for every
            decision. No more bureaucratic black boxes or opaque
            rejections.
          </p>
          <Link
            href="/policies"
            className="inline-block bg-[#d9ff00] text-black font-black uppercase px-10 py-3 rounded-full shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:scale-105 transition-transform"
          >
            Learn More
          </Link>
            </div>
          </div>
        </div>

        <div className="sticky top-32 group cursor-pointer">
          <div className="absolute inset-0 bg-[#d9ff00] rounded-[30px] rotate-2 scale-105 opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative aspect-video bg-zinc-900 border-4 border-white/20 rounded-[30px] flex items-center justify-center overflow-hidden">
            <video
          className="w-full h-full object-cover"
          controls
          autoPlay
          muted
          loop
            >
          <source src="/demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
            </video>
            <div className="absolute bottom-8 left-8 bg-black/80 px-4 py-2 border border-white/10 text-xs font-black uppercase">
          Civis AI Platform Demo
            </div>
          </div>
        </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-[#e4e4db] translate-y-12 skew-y-2 border-t-4 border-black" />
      </section>

      {/* ─── Policy Primitives ─────────────────────────── */}
      <section className="bg-[#e4e4db] py-32 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-20">
          <div className="bg-[#ff5c8d] text-black border-4 border-black rounded-full px-12 py-3 mb-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-2">
            <span className="text-3xl font-black uppercase italic">
              TRUST TOOLS
            </span>
          </div>
          <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-center">
            Policy Primitives.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {["BENEFIT MATCH", "POLICY AUDIT", "SECURE PROOF"].map((title, i) => (
            <div
              key={i}
              className={`bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-2xl flex flex-col items-start ${
                i === 2 ? "pr-16 relative" : ""
              }`}
            >
              <div className="text-[10px] font-black opacity-30 mb-4">
                #0{i + 1}
              </div>
              <h4 className="text-3xl font-black uppercase mb-2 tracking-tighter">
                {title}
              </h4>
              <p className="text-xs font-bold text-gray-400 italic mb-4">
                {i === 0
                  ? "Instant eligibility scanning"
                  : i === 1
                    ? "Deep regulatory analysis"
                    : "Privacy-first verification"}
              </p>
              {i === 2 && (
                <div className="absolute right-0 top-0 bottom-0 w-12 border-l-4 border-black flex items-center justify-center bg-[#d9ff00] rounded-r-xl">
                  <div className="rotate-90 whitespace-nowrap font-black text-[10px]">
                    VERIFY +
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white border-4 border-black p-8 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="font-mono text-sm space-y-2">
            <p className="text-pink-500 font-bold">
              Eligibility Logic:{" "}
              <span className="text-black">
                (User Credentials + Policy Rules) x Verifiable Proof
              </span>
            </p>
            <p className="text-gray-400">
              Auditable, transparent, and fair. No bureaucratic black boxes.
            </p>
          </div>
        </div>
      </section>

      {/* ─── The Pitch (CTA) ───────────────────────────── */}
      <section className="px-6 py-32 max-w-5xl mx-auto">
        <div className="relative group">
          <div className="absolute -inset-2 bg-white border-4 border-black rounded-[40px] -rotate-1 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]" />

          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border-4 border-black px-12 py-3 rounded-full rotate-2 z-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-2xl font-black uppercase italic">
              THE MISSION
            </span>
          </div>

          <div className="relative bg-zinc-950 text-white rounded-[40px] p-12 md:p-20 flex flex-col items-center text-center space-y-10 border-4 border-black overflow-hidden">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(#d9ff00 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            <h2 className="text-5xl md:text-8xl font-black uppercase leading-[0.8] tracking-tighter italic relative z-10">
              THE PITCH IN <br /> ONE BREATH
            </h2>

            <p className="text-lg md:text-2xl font-bold leading-relaxed text-gray-400 max-w-3xl relative z-10">
              Civis AI is a trust-backed eligibility layer for public policy.
              Citizens securely verify qualifications and discover
              yield-generating social benefits. Agencies reduce fraud using
              decentralized IDs. NGOs scale outreach with agent-driven insights.
              Everyone can access the support they deserve.
            </p>

            <Link
              href="/eligibility"
              className="relative z-10 bg-[#d9ff00] text-black px-12 py-5 rounded-full font-black uppercase text-xl shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform"
            >
              Launch Platform
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
