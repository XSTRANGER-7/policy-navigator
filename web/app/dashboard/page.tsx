"use client";

import { useState } from "react";
import VCBadge from "@/components/VCBadge";
import type { VerifiableCredential } from "@/types/credential";

export default function Dashboard() {
  const [query, setQuery]           = useState("");
  const [vc, setVc]                 = useState<VerifiableCredential | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function lookup() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setVc(null);
    setEligibility(null);

    // Try by email via applications API, then fall back to VC lookup by ID
    try {
      const isEmail = q.includes("@");
      const vcUrl   = isEmail
        ? `/api/vc?email=${encodeURIComponent(q)}`
        : `/api/vc?citizenId=${encodeURIComponent(q)}`;
      const eligUrl = isEmail
        ? `/api/eligibility?email=${encodeURIComponent(q)}`
        : `/api/eligibility?citizenId=${encodeURIComponent(q)}`;

      const [vcRes, eligRes] = await Promise.all([
        fetch(vcUrl),
        fetch(eligUrl),
      ]);

      const vcData   = await vcRes.json();
      const eligData = await eligRes.json();

      if (vcRes.ok && vcData.vc)          setVc(vcData.vc);
      if (eligRes.ok && eligData.credential) setEligibility(eligData.credential);

      if (!vcRes.ok && !eligRes.ok) {
        setError(vcData.error || eligData.error || "No record found for that identifier.");
      }
    } catch {
      setError("Network error — make sure agents are running.");
    }

    setLoading(false);
  }

  return (
    <section className="px-6 py-16 md:px-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-[#ff5c8d] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          TRUST PORTAL
        </div>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          VERIFY YOUR<br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">IDENTITY.</span>
        </h1>
        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** Authenticity is proved by a Verifiable Credential issued by the AI pipeline — no login needed.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { icon: "📝", title: "1. Submit Form", desc: "Fill the eligibility check form on the Citizens page with your real details." },
          { icon: "🤖", title: "2. AI Issues VC", desc: "The Credential Agent signs a Verifiable Credential tied to your profile and schemes." },
          { icon: "🔐", title: "3. Verify Here", desc: "Enter your email below to fetch and display your VC — this is your proof of authenticity." },
        ].map((s) => (
          <div key={s.title} className="bg-white border-3 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="font-black uppercase text-sm mb-1">{s.title}</div>
            <div className="text-xs font-bold text-black/60">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Lookup */}
      <div className="civis-card">
        <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-3">
          Your Email or Citizen ID
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="civis-input flex-1 rounded-lg"
            placeholder="you@example.com  or  paste your Citizen UUID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button
            onClick={lookup}
            disabled={loading || !query.trim()}
            className="civis-btn rounded-full whitespace-nowrap px-8"
          >
            {loading ? "Fetching…" : "Fetch VC & Eligibility →"}
          </button>
        </div>
        <p className="text-[11px] font-bold text-black/40 mt-2">
          Use the same email you entered on the Citizens eligibility form.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 bg-[#ff5c8d] border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-sm">⚠ {error}</p>
          <p className="text-xs font-bold text-black/60 mt-1">
            Run an eligibility check first — the VC is issued at the end of that pipeline.
          </p>
        </div>
      )}

      {/* VC Badge */}
      {vc && <VCBadge vc={vc} />}

      {/* Eligibility raw record */}
      {eligibility && (
        <div className="mt-8 bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#d9ff00] font-black text-sm">📋</div>
            <h3 className="font-black text-lg uppercase tracking-tight">Eligibility Record</h3>
          </div>
          <pre className="text-xs bg-white p-4 rounded-xl overflow-x-auto border-2 border-black font-mono">
            {JSON.stringify(eligibility, null, 2)}
          </pre>
        </div>
      )}

      {/* No results state */}
      {!loading && !error && !vc && !eligibility && (
        <div className="mt-10 text-center py-16 border-4 border-dashed border-black/20 rounded-3xl">
          <div className="text-5xl mb-4">🔍</div>
          <p className="font-black uppercase text-black/30 text-sm tracking-widest">
            Enter your email above to fetch your VC
          </p>
        </div>
      )}
    </section>
  );
}
