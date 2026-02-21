"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Scheme {
  id: string;
  name: string;
  category: string;
  description: string | null;
  benefits: string | null;
  eligibility_text: string | null;
  rules: Record<string, unknown>;
  ministry: string | null;
  official_url: string | null;
}

const CATEGORIES = [
  { value: "",            label: "All" },
  { value: "farmer",      label: "Farmer" },
  { value: "student",     label: "Student" },
  { value: "women",       label: "Women" },
  { value: "health",      label: "Health" },
  { value: "general",     label: "General" },
  { value: "bpl",         label: "BPL" },
  { value: "sc_st",       label: "SC/ST" },
  { value: "obc",         label: "OBC" },
  { value: "disabled",    label: "Disabled" },
  { value: "senior_citizen", label: "Senior Citizen" },
];

const CATEGORY_COLORS: Record<string, string> = {
  farmer:         "bg-green-200",
  student:        "bg-blue-200",
  women:          "bg-pink-200",
  health:         "bg-red-200",
  general:        "bg-[#d9ff00]",
  bpl:            "bg-orange-200",
  sc_st:          "bg-purple-200",
  obc:            "bg-indigo-200",
  disabled:       "bg-yellow-200",
  senior_citizen: "bg-teal-200",
};

export default function PoliciesPage() {
  const [schemes, setSchemes]     = useState<Scheme[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [category, setCategory]   = useState("");
  const [q, setQ]                 = useState("");
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search)   params.set("q", search);

    fetch(`/api/policies?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSchemes(d.schemes ?? []);
      })
      .catch(() => setError("Failed to load policies"))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <section className="px-6 py-16 md:px-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-[#d9ff00] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          POLICY DATABASE
        </div>
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          GOVERNMENT <br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">POLICIES.</span>
        </h1>
        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** Live from the database — browse, filter, and check eligibility.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <input
          className="civis-input rounded-full px-4 py-2 text-sm font-bold flex-1 min-w-[200px] max-w-xs"
          placeholder="Search schemes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1 text-[11px] font-black uppercase rounded-full border-2 border-black transition-all
                ${category === c.value ? "bg-black text-[#d9ff00]" : "bg-white text-black hover:bg-[#d9ff00]"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-[#ff5c8d] border-4 border-black rounded-2xl p-6 mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black uppercase">Error loading policies</p>
          <p className="text-sm font-bold mt-1">{error}</p>
          <p className="text-xs font-bold mt-2 text-black/60">
            Make sure Supabase env vars are set in <code>web/.env.local</code> and schema.sql has been run.
          </p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && schemes.length === 0 && (
        <div className="bg-white border-4 border-black rounded-2xl p-10 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-xl uppercase">No Schemes Found</p>
          <p className="font-bold text-black/50 mt-2 text-sm">
            Try a different filter or{" "}
            <Link href="/eligibility" className="underline">run the eligibility check</Link>.
          </p>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && schemes.length > 0 && (
        <>
          <p className="text-xs font-black uppercase tracking-widest text-black/40 mb-4">
            {schemes.length} scheme{schemes.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {schemes.map((s, i) => {
              const isOpen = expanded === s.id;
              const badgeColor = CATEGORY_COLORS[s.category] ?? "bg-[#d9ff00]";
              const rules = s.rules as Record<string, unknown>;

              return (
                <div
                  key={s.id}
                  className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-[10px] font-black text-black/30 mb-1">
                          #{String(i + 1).padStart(2, "0")}
                        </div>
                        <h3 className="font-black text-xl uppercase tracking-tight text-black">
                          {s.name}
                        </h3>
                        {s.ministry && (
                          <p className="text-[10px] font-bold text-black/40 mt-0.5">{s.ministry}</p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 ${badgeColor} border-2 border-black px-3 py-1 text-[10px] font-black uppercase rounded-full`}>
                        {s.category}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-black/60 mb-3">{s.description ?? "—"}</p>

                    {rules && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {rules.age_min !== undefined && (
                          <span className="text-[10px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                            Age {String(rules.age_min)}–{String(rules.age_max ?? "∞")}
                          </span>
                        )}
                        {rules.income_max !== undefined && (
                          <span className="text-[10px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                            Income ≤ ₹{Number(rules.income_max).toLocaleString("en-IN")}
                          </span>
                        )}
                        {Array.isArray(rules.categories) &&
                          (rules.categories as string[]).slice(0, 3).map((cat: string) => (
                            <span key={cat} className="text-[10px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                              {cat}
                            </span>
                          ))}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                      className="text-[11px] font-black uppercase underline text-black/50 hover:text-black transition-colors"
                    >
                      {isOpen ? "← Hide details" : "View details →"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t-4 border-black bg-zinc-50 p-6 space-y-4">
                      {s.benefits && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Benefits</p>
                          <p className="text-sm font-bold text-black">{s.benefits}</p>
                        </div>
                      )}
                      {s.eligibility_text && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Eligibility</p>
                          <p className="text-sm font-bold text-black/70">{s.eligibility_text}</p>
                        </div>
                      )}
                      <div className="flex gap-3 pt-2">
                        {s.official_url && (
                          <a
                            href={s.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-black uppercase bg-black text-[#d9ff00] px-4 py-2 rounded-full hover:opacity-80 transition-opacity"
                          >
                            Official Site ↗
                          </a>
                        )}
                        <Link
                          href={`/eligibility?category=${s.category}`}
                          className="text-[11px] font-black uppercase border-2 border-black px-4 py-2 rounded-full hover:bg-[#d9ff00] transition-colors"
                        >
                          Check My Eligibility →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* CTA */}
      <div className="bg-zinc-950 border-4 border-black rounded-2xl p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-4">
          NOT SURE WHICH SCHEME <span className="text-[#d9ff00]">FITS YOU?</span>
        </h2>
        <p className="text-gray-400 font-bold mb-8 max-w-xl mx-auto">
          Let our AI agent analyze your profile and find all government schemes you qualify for.
        </p>
        <Link
          href="/eligibility"
          className="inline-block bg-[#d9ff00] text-black px-10 py-4 rounded-full font-black uppercase text-lg shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform"
        >
          Check Eligibility Now →
        </Link>
      </div>
    </section>
  );
}
