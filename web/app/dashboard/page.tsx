"use client";

import { useState } from "react";
import VCBadge from "@/components/VCBadge";

export default function Dashboard() {
  const [citizenId, setCitizenId] = useState("");
  const [vc, setVc] = useState(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchVC() {
    if (!citizenId.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vc?citizenId=${citizenId}`);
      const data = await res.json();

      if (res.ok) {
        setVc(data.vc);
      } else {
        setError(data.error || "Failed to fetch credential");
        setVc(null);
      }
    } catch {
      setError("Network error");
    }

    setLoading(false);
  }

  async function fetchEligibility() {
    if (!citizenId.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/eligibility?citizenId=${citizenId}`);
      const data = await res.json();

      if (res.ok) {
        setEligibility(data.credential);
      } else {
        setError(data.error || "No eligibility data found");
        setEligibility(null);
      }
    } catch {
      setError("Network error");
    }

    setLoading(false);
  }

  return (
    <section className="px-6 py-16 md:px-12 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-[#ff5c8d] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          TRUST PORTAL
        </div>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          YOUR <br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">
            DASHBOARD.
          </span>
        </h1>

        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** View eligibility records and verified credentials.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="civis-card">
        <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-3">
          Citizen ID
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="civis-input flex-1 rounded-lg"
            placeholder="Enter your Citizen ID (UUID)"
            value={citizenId}
            onChange={(e) => setCitizenId(e.target.value)}
          />
          <button
            onClick={fetchEligibility}
            disabled={loading || !citizenId.trim()}
            className="civis-btn rounded-full whitespace-nowrap"
          >
            Eligibility
          </button>
          <button
            onClick={fetchVC}
            disabled={loading || !citizenId.trim()}
            className="civis-btn civis-btn-alt rounded-full whitespace-nowrap"
          >
            Fetch VC
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 bg-[#ff5c8d] border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-bold text-sm text-black">{error}</p>
        </div>
      )}

      {/* Eligibility data */}
      {eligibility && (
        <div className="mt-8 bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#d9ff00] font-black text-sm">
              📋
            </div>
            <h3 className="font-black text-lg uppercase tracking-tight">
              Eligibility Record
            </h3>
          </div>
          <pre className="text-xs bg-white p-4 rounded-xl overflow-x-auto border-3 border-black font-mono">
            {JSON.stringify(eligibility, null, 2)}
          </pre>
        </div>
      )}

      {/* VC Badge */}
      <VCBadge vc={vc} />
    </section>
  );
}
