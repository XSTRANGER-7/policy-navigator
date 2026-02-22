"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  source: string | null;
  state_specific: boolean;
  scraped_at: string | null;
  created_at: string;
}

interface ScrapedScheme {
  id: string;
  name: string;
  category?: string;
  description?: string | null;
  benefits?: string | null;
  eligibility_text?: string | null;
  rules?: Record<string, unknown>;
  ministry?: string | null;
  official_url?: string | null;
  source?: string | null;
  state_specific?: boolean;
}

interface ScrapeResult {
  ok: boolean;
  total: number;
  newCount: number;
  existingCount: number;
  savedCount: number;
  newSchemes: ScrapedScheme[];
  allSchemes: ScrapedScheme[];
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORIES = [
  { value: "",               label: "All Categories",   icon: "ðŸ›" },
  { value: "farmer",         label: "Farmer",           icon: "ðŸŒ¾" },
  { value: "student",        label: "Student",          icon: "ðŸŽ“" },
  { value: "women",          label: "Women",            icon: "ðŸ‘©" },
  { value: "health",         label: "Health",           icon: "ðŸ¥" },
  { value: "bpl",            label: "BPL",              icon: "ðŸš" },
  { value: "sc_st",          label: "SC/ST",            icon: "âš–ï¸" },
  { value: "obc",            label: "OBC",              icon: "ðŸ“‹" },
  { value: "disabled",       label: "Disabled",         icon: "â™¿" },
  { value: "senior_citizen", label: "Senior Citizen",   icon: "ðŸ‘´" },
  { value: "general",        label: "General",          icon: "ðŸ“Œ" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  farmer:         { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300"  },
  student:        { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300"   },
  women:          { bg: "bg-pink-100",   text: "text-pink-800",   border: "border-pink-300"   },
  health:         { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-300"    },
  bpl:            { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  sc_st:          { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
  obc:            { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
  disabled:       { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  senior_citizen: { bg: "bg-teal-100",   text: "text-teal-800",   border: "border-teal-300"   },
  general:        { bg: "bg-[#d9ff00]",  text: "text-black",      border: "border-black/30"   },
};

const SOURCE_LABELS: Record<string, string> = {
  "myscheme.gov.in":     "myScheme",
  "pmindia.gov.in":      "PMIndia",
  "india.gov.in":        "India.gov",
  "pmkisan.gov.in":      "PMKisan",
  "pmjay.gov.in":        "AB-PMJAY",
  "scholarships.gov.in": "NSP",
  "builtin":             "Verified",
};

function sourceBadge(source: string | null) {
  if (!source) return null;
  const label = SOURCE_LABELS[source] ?? source.replace(/^www\./, "").replace(/\..*$/, "");
  const isGov = source.includes(".gov.in") || source.includes("gov.in");
  return { label, isGov };
}

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SchemesPage() {
  const router       = useRouter();
  const urlParams    = useSearchParams();

  const [schemes,     setSchemes]     = useState<Scheme[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<string | null>(null);

  // Filters
  const [q,           setQ]           = useState(urlParams.get("q") ?? "");
  const [debouncedQ,  setDebouncedQ]  = useState(q);
  const [category,    setCategory]    = useState(urlParams.get("category") ?? "");
  const [source,      setSource]      = useState(urlParams.get("source") ?? "");
  const [ministry,    setMinistry]    = useState("");
  const [stateSpec,   setStateSpec]   = useState<"" | "true" | "false">("");
  const [page,        setPage]        = useState(1);
  const LIMIT = 24;

  // Filter options from API
  const [allSources,    setAllSources]    = useState<string[]>([]);
  const [allMinistries, setAllMinistries] = useState<string[]>([]);

  // Scraper modal
  const [scraperOpen,    setScraperOpen]    = useState(false);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperResult,  setScraperResult]  = useState<ScrapeResult | null>(null);
  const [scraperError,   setScraperError]   = useState<string | null>(null);
  const [scraperTab,     setScraperTab]     = useState<"new" | "all">("new");
  const [addedIds,       setAddedIds]       = useState<Set<string>>(new Set());
  const [addingIds,      setAddingIds]      = useState<Set<string>>(new Set());
  const [addAllLoading,  setAddAllLoading]  = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category)           params.set("category", category);
    if (debouncedQ)         params.set("q", debouncedQ);
    if (source)             params.set("source", source);
    if (ministry)           params.set("ministry", ministry);
    if (stateSpec)          params.set("state_specific", stateSpec);
    params.set("limit",  String(LIMIT));
    params.set("page",   String(page));

    try {
      const r = await fetch(`/api/schemes?${params}`);
      const d = await r.json();
      if (d.error) { setError(d.error); setSchemes([]); }
      else {
        setSchemes(d.schemes ?? []);
        setTotal(d.total ?? 0);
        if (d.sources)    setAllSources(d.sources);
        if (d.ministries) setAllMinistries(d.ministries);
      }
    } catch {
      setError("Failed to load schemes");
    }
    setLoading(false);
  }, [category, debouncedQ, source, ministry, stateSpec, page]);

  useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

  const totalPages = Math.ceil(total / LIMIT);

  // ── Scraper handlers ───────────────────────────────────────────────────────
  async function runScraper(source: string) {
    setScraperLoading(true);
    setScraperError(null);
    setScraperResult(null);
    setAddedIds(new Set());
    try {
      const res  = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScraperError(data.error ?? "Scraper failed");
      } else {
        setScraperResult(data as ScrapeResult);
        setScraperTab(data.newCount > 0 ? "new" : "all");
      }
    } catch {
      setScraperError("Network error — make sure the app is running.");
    }
    setScraperLoading(false);
  }

  async function addScheme(scheme: ScrapedScheme) {
    setAddingIds((prev) => new Set(prev).add(scheme.id));
    try {
      const res = await fetch("/api/scrape/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheme),
      });
      const data = await res.json();
      if (data.ok) {
        setAddedIds((prev) => new Set(prev).add(scheme.id));
        fetchSchemes(); // refresh the main list
      } else {
        alert("Failed to add scheme: " + (data.error ?? "unknown error"));
      }
    } catch {
      alert("Network error when saving scheme.");
    }
    setAddingIds((prev) => { const s = new Set(prev); s.delete(scheme.id); return s; });
  }

  async function addAllNew() {
    if (!scraperResult?.newSchemes.length) return;
    setAddAllLoading(true);
    const toAdd = scraperResult.newSchemes.filter((s) => !addedIds.has(s.id));
    for (const scheme of toAdd) {
      await addScheme(scheme);
    }
    setAddAllLoading(false);
  }

  function resetFilters() {
    setQ(""); setDebouncedQ(""); setCategory(""); setSource("");
    setMinistry(""); setStateSpec(""); setPage(1);
  }

  const activeFilterCount = [category, source, ministry, stateSpec, debouncedQ].filter(Boolean).length;

  // ── Scraper Modal ──────────────────────────────────────────────────────────
  const displaySchemes = scraperTab === "new"
    ? (scraperResult?.newSchemes ?? [])
    : (scraperResult?.allSchemes ?? []);

  const ScraperModal = scraperOpen ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12">
      <div className="w-full max-w-3xl bg-white border-4 border-black rounded-3xl shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden">

        {/* Modal Header */}
        <div className="bg-black text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="font-black text-xl uppercase tracking-tighter">🔄 Scheme Scraper</h2>
            <p className="text-white/50 text-xs font-bold mt-0.5">Pull latest schemes from official government portals</p>
          </div>
          <button
            onClick={() => setScraperOpen(false)}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-black text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Source selector */}
        {!scraperLoading && !scraperResult && !scraperError && (
          <div className="p-6 space-y-4">
            <p className="font-black text-sm uppercase tracking-widest text-black/40 mb-4">Choose scrape source</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { source: "builtin",  label: "Built-in Dataset",  icon: "📦", desc: "39 verified real schemes — instant, no network", fast: true },
                { source: "myscheme", label: "myScheme.gov.in",    icon: "🏛️", desc: "Scrape individual scheme pages from the official portal", fast: false },
                { source: "pmindia",  label: "PMIndia.gov.in",     icon: "🇮🇳", desc: "Scheme listings from PM India portal", fast: false },
                { source: "all",      label: "All Sources",        icon: "🌐", desc: "Built-in + live scrape from all portals (slowest)", fast: false },
              ].map(({ source, label, icon, desc, fast }) => (
                <button
                  key={source}
                  onClick={() => runScraper(source)}
                  className="text-left p-4 border-[3px] border-black rounded-2xl hover:bg-[#d9ff00] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{icon}</span>
                    <span className="font-black text-sm uppercase">{label}</span>
                    {fast && <span className="text-[8px] bg-green-100 text-green-700 border border-green-300 rounded-full px-1.5 py-0.5 font-black uppercase">Fast</span>}
                  </div>
                  <p className="text-xs font-bold text-black/50 group-hover:text-black/70">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {scraperLoading && (
          <div className="p-12 flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-black" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="font-black uppercase text-sm">Scraping government portals…</p>
            <p className="text-xs text-black/40 font-bold">This may take a moment for live sources</p>
          </div>
        )}

        {/* Error state */}
        {!scraperLoading && scraperError && (
          <div className="p-6">
            <div className="bg-red-50 border-4 border-red-300 rounded-2xl p-5">
              <p className="font-black uppercase text-red-700">Scraper Error</p>
              <p className="text-sm font-bold text-red-600 mt-1">{scraperError}</p>
            </div>
            <button onClick={() => { setScraperError(null); }} className="mt-4 bg-black text-[#d9ff00] font-black text-xs uppercase px-5 py-2 rounded-full">
              ← Back
            </button>
          </div>
        )}

        {/* Results */}
        {!scraperLoading && scraperResult && (
          <div className="p-6 space-y-4">

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black text-white rounded-2xl p-3 text-center">
                <p className="font-black text-2xl text-[#d9ff00]">{scraperResult.total}</p>
                <p className="text-[9px] font-black uppercase text-white/50">Scraped</p>
              </div>
              <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-3 text-center">
                <p className="font-black text-2xl">{scraperResult.newCount}</p>
                <p className="text-[9px] font-black uppercase text-black/50">New Schemes</p>
              </div>
              <div className="bg-white border-4 border-black rounded-2xl p-3 text-center">
                <p className="font-black text-2xl">{scraperResult.existingCount}</p>
                <p className="text-[9px] font-black uppercase text-black/50">Already in DB</p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  onClick={() => setScraperTab("new")}
                  className={`px-4 py-1.5 rounded-full font-black text-xs uppercase border-2 border-black transition-colors ${
                    scraperTab === "new" ? "bg-black text-[#d9ff00]" : "hover:bg-[#d9ff00]"
                  }`}
                >
                  New ({scraperResult.newCount})
                </button>
                <button
                  onClick={() => setScraperTab("all")}
                  className={`px-4 py-1.5 rounded-full font-black text-xs uppercase border-2 border-black transition-colors ${
                    scraperTab === "all" ? "bg-black text-[#d9ff00]" : "hover:bg-[#d9ff00]"
                  }`}
                >
                  All ({scraperResult.total})
                </button>
              </div>
              <div className="flex gap-2">
                {scraperResult.newCount > 0 && (
                  <button
                    onClick={addAllNew}
                    disabled={addAllLoading || scraperResult.newSchemes.every((s) => addedIds.has(s.id))}
                    className="bg-[#d9ff00] border-[3px] border-black font-black text-xs uppercase px-4 py-1.5 rounded-full disabled:opacity-40 hover:bg-black hover:text-[#d9ff00] transition-colors"
                  >
                    {addAllLoading ? "Adding…" : `Add All New (${scraperResult.newCount - addedIds.size})`}
                  </button>
                )}
                <button
                  onClick={() => { setScraperResult(null); setScraperError(null); setAddedIds(new Set()); }}
                  className="border-[3px] border-black font-black text-xs uppercase px-4 py-1.5 rounded-full hover:bg-black hover:text-white transition-colors"
                >
                  ← Re-run
                </button>
              </div>
            </div>

            {/* Scheme list */}
            {displaySchemes.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">🎉</p>
                <p className="font-black uppercase">All schemes are already in the database!</p>
                <p className="text-xs text-black/50 font-bold mt-1">Nothing new to add.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {displaySchemes.map((s) => {
                  const isAdded   = addedIds.has(s.id);
                  const isAdding  = addingIds.has(s.id);
                  const isInDb    = scraperResult.allSchemes.findIndex((x) => x.id === s.id) !== -1
                                    && !scraperResult.newSchemes.some((x) => x.id === s.id);
                  const colors    = CATEGORY_COLORS[s.category ?? "general"] ?? CATEGORY_COLORS.general;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-start gap-3 p-3 border-[3px] rounded-xl transition-colors ${
                        isAdded ? "border-green-400 bg-green-50" : "border-black hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {s.category ?? "general"}
                          </span>
                          {s.source && (
                            <span className="text-[8px] font-black bg-green-50 text-green-700 border border-green-300 px-2 py-0.5 rounded-full uppercase">
                              {SOURCE_LABELS[s.source] ?? s.source}
                            </span>
                          )}
                        </div>
                        <p className="font-black text-sm text-black leading-tight">{s.name}</p>
                        {s.ministry && <p className="text-[10px] font-bold text-black/40 mt-0.5 truncate">{s.ministry}</p>}
                        {s.description && <p className="text-[10px] font-bold text-black/50 mt-0.5 line-clamp-2 leading-relaxed">{s.description}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {isAdded ? (
                          <span className="text-[10px] font-black text-green-700 bg-green-100 border border-green-400 px-3 py-1.5 rounded-full">✓ Added</span>
                        ) : isInDb ? (
                          <span className="text-[10px] font-black text-black/40 bg-black/5 border border-black/20 px-3 py-1.5 rounded-full">In DB</span>
                        ) : (
                          <button
                            onClick={() => addScheme(s)}
                            disabled={isAdding}
                            className="text-[10px] font-black uppercase bg-[#d9ff00] border-2 border-black px-3 py-1.5 rounded-full hover:bg-black hover:text-[#d9ff00] transition-colors disabled:opacity-50"
                          >
                            {isAdding ? "…" : "+ Add to DB"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  ) : null;

  return (
    <section className="px-4 md:px-8 py-12 max-w-7xl mx-auto">
      {ScraperModal}

      {/* â”€â”€ Hero â”€â”€ */}
      <div className="mb-12 relative overflow-hidden bg-black border-4 border-black rounded-3xl p-8 md:p-14 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)]">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "linear-gradient(rgba(217,255,0,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(217,255,0,0.3) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#d9ff00] border-2 border-[#d9ff00] rounded-full px-4 py-1.5 font-black text-[10px] uppercase mb-6">
            <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
            SCRAPED FROM OFFICIAL GOV PORTALS
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white leading-[0.9] mb-4">
            GOVERNMENT<br />
            <span className="text-[#d9ff00]">SCHEMES.</span>
          </h1>
          <p className="text-white/60 font-bold text-lg max-w-xl">
            {total > 0 ? total : "400"}+ schemes scraped from myscheme.gov.in, pmindia.gov.in and official portals â€” updated regularly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-[#d9ff00] font-black text-2xl">{total || "â€"}</p>
              <p className="text-white/60 text-[10px] font-black uppercase">Total Schemes</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-[#d9ff00] font-black text-2xl">{allSources.length || "5"}+</p>
              <p className="text-white/60 text-[10px] font-black uppercase">Gov Sources</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-[#d9ff00] font-black text-2xl">{allMinistries.length || "20"}+</p>
              <p className="text-white/60 text-[10px] font-black uppercase">Ministries</p>
            </div>
            <button
              onClick={() => { setScraperOpen(true); setScraperResult(null); setScraperError(null); }}
              className="flex items-center gap-2 bg-[#d9ff00] border-[3px] border-[#d9ff00] text-black rounded-xl px-5 py-2 font-black text-xs uppercase tracking-wide hover:bg-white transition-colors shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)]"
            >
              <span className="text-base">🔄</span> Scrape Latest Schemes
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* â”€â”€ Sidebar Filters â”€â”€ */}
        <aside className="lg:w-72 flex-shrink-0 space-y-5">

          {/* Search */}
          <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Search</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40">ðŸ”</span>
              <input
                className="civis-input w-full rounded-lg pl-8 text-sm"
                placeholder="Kisan, scholarship, healthâ€¦"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Category</p>
            <div className="space-y-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value); setPage(1); }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-black transition-colors ${
                    category === c.value
                      ? "bg-black text-[#d9ff00]"
                      : "hover:bg-black/5 text-black"
                  }`}
                >
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source filter */}
          {allSources.length > 0 && (
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Source</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setSource(""); setPage(1); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-colors ${
                    !source ? "bg-black text-[#d9ff00]" : "hover:bg-black/5"
                  }`}
                >
                  All Sources
                </button>
                {allSources.map((s) => {
                  const badge = sourceBadge(s);
                  return (
                    <button
                      key={s}
                      onClick={() => { setSource(s); setPage(1); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-colors flex items-center justify-between ${
                        source === s ? "bg-black text-[#d9ff00]" : "hover:bg-black/5"
                      }`}
                    >
                      <span>{badge?.label ?? s}</span>
                      {badge?.isGov && (
                        <span className="text-[8px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full">GOV</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scope filter */}
          <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Scope</p>
            {(["", "false", "true"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setStateSpec(v); setPage(1); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black mb-1 transition-colors ${
                  stateSpec === v ? "bg-black text-[#d9ff00]" : "hover:bg-black/5"
                }`}
              >
                {v === "" ? "All" : v === "false" ? "ðŸ‡®ðŸ‡³ Central Schemes" : "ðŸ—º State Specific"}
              </button>
            ))}
          </div>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="w-full bg-[#ff5c8d] border-4 border-black rounded-2xl py-3 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              âœ• Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
            </button>
          )}

          {/* Scraper sidebar button */}
          <button
            onClick={() => { setScraperOpen(true); setScraperResult(null); setScraperError(null); }}
            className="w-full bg-[#d9ff00] border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
          >
            <p className="font-black text-sm uppercase mb-1 flex items-center gap-2">🔄 Scrape &amp; Update DB</p>
            <p className="text-xs font-bold text-black/60">Pull latest schemes from official government portals and add new ones to the database.</p>
          </button>
        </aside>

        {/* â”€â”€ Main content â”€â”€ */}
        <div className="flex-1 min-w-0">

          {/* Active filters bar */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {category && (
                <span className="flex items-center gap-1.5 bg-black text-[#d9ff00] text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 border-black">
                  {CATEGORIES.find((c) => c.value === category)?.icon} {CATEGORIES.find((c) => c.value === category)?.label}
                  <button onClick={() => setCategory("")} className="ml-1 hover:opacity-70">Ã—</button>
                </span>
              )}
              {source && (
                <span className="flex items-center gap-1.5 bg-black text-[#d9ff00] text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 border-black">
                  {SOURCE_LABELS[source] ?? source}
                  <button onClick={() => setSource("")} className="ml-1 hover:opacity-70">Ã—</button>
                </span>
              )}
              {stateSpec && (
                <span className="flex items-center gap-1.5 bg-black text-[#d9ff00] text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 border-black">
                  {stateSpec === "true" ? "State Specific" : "Central Schemes"}
                  <button onClick={() => setStateSpec("")} className="ml-1 hover:opacity-70">Ã—</button>
                </span>
              )}
              {debouncedQ && (
                <span className="flex items-center gap-1.5 bg-black text-[#d9ff00] text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 border-black">
                  "{debouncedQ}"
                  <button onClick={() => { setQ(""); setDebouncedQ(""); }} className="ml-1 hover:opacity-70">Ã—</button>
                </span>
              )}
            </div>
          )}

          {/* Results header */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-black uppercase tracking-widest text-black/40">
              {loading ? "Loadingâ€¦" : `${total} scheme${total !== 1 ? "s" : ""}`}
              {page > 1 && ` â€” Page ${page}`}
            </p>
            <Link
              href="/eligibility"
              className="text-[11px] font-black uppercase bg-[#d9ff00] border-2 border-black px-4 py-1.5 rounded-full hover:bg-black hover:text-[#d9ff00] transition-colors"
            >
              Check My Eligibility â†’
            </Link>
          </div>

          {/* Spinner */}
          {loading && (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-4">
                <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="font-black uppercase text-sm text-black/40">Fetching schemesâ€¦</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="bg-[#ff5c8d] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-black uppercase">Error Loading Schemes</p>
              <p className="text-sm font-bold mt-1">{error}</p>
              <p className="text-xs font-bold mt-2 text-black/70">
                Make sure Supabase is configured and the scraper has been run.
              </p>
              <button onClick={fetchSchemes} className="mt-3 bg-black text-white font-black text-xs uppercase px-4 py-2 rounded-full">
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && schemes.length === 0 && (
            <div className="bg-white border-4 border-black rounded-2xl p-12 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-4xl mb-3">ðŸ›</p>
              <p className="font-black text-xl uppercase">No Schemes Found</p>
              <p className="font-bold text-black/50 mt-2 text-sm max-w-xs mx-auto">
                Try clearing filters or run the scraper to populate the database.
              </p>
              <div className="mt-4 flex gap-3 justify-center">
                <button onClick={resetFilters} className="civis-btn rounded-full px-6 py-2 text-sm">
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Scheme Cards Grid */}
          {!loading && !error && schemes.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {schemes.map((s, i) => {
                const isOpen   = expanded === s.id;
                const colors   = CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.general;
                const srcBadge = sourceBadge(s.source);
                const rules    = s.rules;

                return (
                  <div
                    key={s.id}
                    className="bg-white border-4 border-black rounded-2xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden"
                  >
                    <div className="p-5">
                      {/* Header row */}
                      <div className="flex items-start gap-3 mb-3">
                        {/* Rank */}
                        <span className="flex-shrink-0 w-8 h-8 bg-[#d9ff00] border-2 border-black rounded-full flex items-center justify-center text-[10px] font-black">
                          {(page - 1) * LIMIT + i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {/* Category badge */}
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                              {CATEGORIES.find((c) => c.value === s.category)?.icon ?? "ðŸ“Œ"} {s.category}
                            </span>
                            {/* Source badge */}
                            {srcBadge && (
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${srcBadge.isGov ? "bg-green-50 text-green-700 border-green-300" : "bg-gray-100 text-gray-600 border-gray-300"}`}>
                                {srcBadge.isGov ? "ðŸ› " : ""}{srcBadge.label}
                              </span>
                            )}
                            {/* State specific */}
                            {s.state_specific && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-300">
                                ðŸ—º State
                              </span>
                            )}
                          </div>
                          <h3 className="font-black text-base uppercase tracking-tight text-black leading-tight">
                            {s.name}
                          </h3>
                          {s.ministry && (
                            <p className="text-[10px] font-bold text-black/40 mt-0.5 truncate">{s.ministry}</p>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs font-bold text-black/60 leading-relaxed mb-3 line-clamp-2">
                        {s.description ?? "Government scheme â€” view details for eligibility and benefits."}
                      </p>

                      {/* Rules pills */}
                      {rules && Object.keys(rules).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {rules.max_income !== undefined && (
                            <span className="text-[9px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                              Income â‰¤ â‚¹{Number(rules.max_income).toLocaleString("en-IN")}
                            </span>
                          )}
                          {rules.min_age !== undefined && (
                            <span className="text-[9px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                              Age â‰¥ {String(rules.min_age)}
                            </span>
                          )}
                          {rules.max_age !== undefined && (
                            <span className="text-[9px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                              Age â‰¤ {String(rules.max_age)}
                            </span>
                          )}
                          {rules.max_land_ha !== undefined && (
                            <span className="text-[9px] font-black bg-black/5 border border-black/10 rounded-full px-2 py-0.5">
                              Land â‰¤ {String(rules.max_land_ha)} ha
                            </span>
                          )}
                          {rules.free === true && (
                            <span className="text-[9px] font-black bg-green-50 border border-green-300 text-green-700 rounded-full px-2 py-0.5">
                              Free
                            </span>
                          )}
                          {rules.cashless === true && (
                            <span className="text-[9px] font-black bg-blue-50 border border-blue-300 text-blue-700 rounded-full px-2 py-0.5">
                              Cashless
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setExpanded(isOpen ? null : s.id)}
                          className="text-[10px] font-black uppercase underline text-black/40 hover:text-black transition-colors"
                        >
                          {isOpen ? "â† Hide" : "Details â†’"}
                        </button>
                        <Link
                          href={`/eligibility?category=${s.category}`}
                          className="text-[10px] font-black uppercase bg-[#d9ff00] border-2 border-black px-3 py-1 rounded-full hover:bg-black hover:text-[#d9ff00] transition-colors"
                        >
                          Am I Eligible?
                        </Link>
                      </div>
                    </div>

                    {/* Expanded details panel */}
                    {isOpen && (
                      <div className="border-t-4 border-black bg-zinc-50 p-5 space-y-4">
                        {s.benefits && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-1">Benefits</p>
                            <p className="text-sm font-bold text-black leading-relaxed">{s.benefits}</p>
                          </div>
                        )}
                        {s.eligibility_text && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-1">Eligibility</p>
                            <p className="text-sm font-bold text-black/70 leading-relaxed">{s.eligibility_text}</p>
                          </div>
                        )}
                        {s.scraped_at && (
                          <p className="text-[9px] font-bold text-black/30">
                            Last synced: {new Date(s.scraped_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {s.official_url && (
                            <a
                              href={s.official_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black uppercase bg-black text-[#d9ff00] px-4 py-2 rounded-full hover:opacity-80 transition-opacity"
                            >
                              Official Portal â†—
                            </a>
                          )}
                          <Link
                            href={`/eligibility?category=${s.category}`}
                            className="text-[10px] font-black uppercase border-2 border-black px-4 py-2 rounded-full hover:bg-[#d9ff00] transition-colors"
                          >
                            Check My Eligibility â†’
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* â”€â”€ Pagination â”€â”€ */}
          {totalPages > 1 && !loading && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 border-[3px] border-black rounded-full font-black text-sm disabled:opacity-30 hover:bg-[#d9ff00] transition-colors"
              >
                â† Prev
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-full font-black text-sm border-2 border-black transition-colors ${
                        page === p ? "bg-black text-[#d9ff00]" : "hover:bg-[#d9ff00]"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                {totalPages > 7 && <span className="self-center font-bold text-black/40">â€¦{totalPages}</span>}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border-[3px] border-black rounded-full font-black text-sm disabled:opacity-30 hover:bg-[#d9ff00] transition-colors"
              >
                Next â†’
              </button>
            </div>
          )}

        </div>
      </div>

      {/* â”€â”€ CTA Section â”€â”€ */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-3xl uppercase tracking-tight">Don&apos;t know<br />which fits?</p>
          <p className="font-bold text-black/60 mt-2 text-sm">Our AI checks all schemes against your profile in seconds.</p>
          <Link href="/eligibility" className="mt-5 inline-block bg-black text-[#d9ff00] font-black uppercase px-6 py-3 rounded-full text-sm hover:opacity-80 transition-opacity">
            AI Eligibility Check â†’
          </Link>
        </div>
        <div className="bg-black border-4 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-white">
          <p className="font-black text-3xl uppercase tracking-tight text-[#d9ff00]">Government<br />Agency?</p>
          <p className="font-bold text-white/60 mt-2 text-sm">Register your organisation and review citizen applications through the Agency Portal.</p>
          <Link href="/agency" className="mt-5 inline-block bg-[#d9ff00] text-black font-black uppercase px-6 py-3 rounded-full text-sm hover:opacity-80 transition-opacity">
            Agency Portal â†’
          </Link>
        </div>
      </div>

    </section>
  );
}
