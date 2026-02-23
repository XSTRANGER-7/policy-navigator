"use client";

import { useState } from "react";
import SchemeCard from "@/components/SchemeCard";
import VCBadge from "@/components/VCBadge";
import SchemeDetailModal from "@/components/SchemeDetailModal";
import ApplyModal from "@/components/ApplyModal";
import type { AgentPipelineResponse } from "@/types/citizen";
import type { RankedScheme } from "@/types/scheme";

type ResultState =
  | { kind: "success"; data: AgentPipelineResponse }
  | { kind: "plain"; text: string }
  | { kind: "error"; message: string }
  | null;

const PIPELINE_LABELS: Record<string, string> = {
  policy_fetch:       "Policy Agent",
  eligibility_check:  "Eligibility Agent",
  scheme_ranking:     "Matcher Agent",
  vc_issuance:        "Credential Agent",
};

export default function CitizenForm({ defaultCategory = "" }: { defaultCategory?: string } = {}) {
  const [form, setForm] = useState({
    email: "", age: "", income: "", state: "", category: defaultCategory,
  });
  const [loading, setLoading]     = useState(false);
  const [savedToDB, setSavedToDB] = useState(false);
  const [citizenId, setCitizenId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [result, setResult]       = useState<ResultState>(null);
  const [appliedSchemes, setAppliedSchemes] = useState<Record<string, { application_id: string; scheme_name: string; status: string; submitted_at?: string }>>({});
  const [appsRefreshing, setAppsRefreshing] = useState(false);

  // Modal state
  const [detailScheme, setDetailScheme] = useState<RankedScheme | null>(null);
  const [applyScheme,  setApplyScheme]  = useState<RankedScheme | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setSavedToDB(false);

    // Single call: saves citizen + runs pipeline + saves VC — all in /api/agent
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:    form.email,
          age:      Number(form.age),
          income:   Number(form.income),
          state:    form.state,
          category: form.category,
        }),
      });
      const d = await r.json();

      if (!r.ok) {
        setResult({ kind: "error", message: d.error || "Agent returned an error" });
      } else {
        if (d.saved_to_db) setSavedToDB(true);
        if (d.citizen_id)  setCitizenId(d.citizen_id);
        if (d.verified)    setIsVerified(true);
        const resp = d.response;
        if (resp && typeof resp === "object" && "ranked_schemes" in resp) {
          setResult({ kind: "success", data: resp as AgentPipelineResponse });
        } else if (typeof resp === "string") {
          setResult({ kind: "plain", text: resp });
        } else {
          setResult({ kind: "error", message: "Unexpected response format" });
        }
      }
    } catch (err: unknown) {
      setResult({ kind: "error", message: (err as Error).message || "Failed to reach the agent" });
    }

    setLoading(false);
  }

  function handleApplied(applicationId: string, schemeId: string, schemeName: string) {
    setAppliedSchemes((prev) => ({
      ...prev,
      [schemeId]: { application_id: applicationId, scheme_name: schemeName, status: "started", submitted_at: new Date().toISOString() },
    }));
  }

  async function refreshApps() {
    if (!citizenId) return;
    setAppsRefreshing(true);
    try {
      const r = await fetch(`/api/applications?citizenId=${citizenId}`);
      const d = await r.json();
      if (d.applications) {
        setAppliedSchemes((prev) => {
          const next = { ...prev };
          (d.applications as Array<{ id: string; scheme_id: string; scheme_name: string; status: string; submitted_at: string }>).forEach((app) => {
            if (app.scheme_id) {
              next[app.scheme_id] = { application_id: app.id, scheme_name: app.scheme_name, status: app.status, submitted_at: app.submitted_at };
            }
          });
          return next;
        });
      }
    } catch { /* ignore */ }
    setAppsRefreshing(false);
  }

  const citizenData = {
    age: Number(form.age), income: Number(form.income),
    state: form.state, category: form.category, email: form.email,
  };

  return (
    <div className="max-w-3xl">
      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="civis-card space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">Email</label>
            <input className="civis-input w-full rounded-lg" placeholder="your@email.com" type="email" required
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">Age</label>
            <input className="civis-input w-full rounded-lg" placeholder="25" type="number" required min={1} max={120}
              value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">Annual Income (₹)</label>
            <input className="civis-input w-full rounded-lg" placeholder="250000" type="number" required min={0}
              value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">State</label>
            <input className="civis-input w-full rounded-lg" placeholder="Maharashtra"
              value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">Category</label>
          <select className="civis-select w-full rounded-lg" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Select a category</option>
            <option value="student">Student</option>
            <option value="farmer">Farmer</option>
            <option value="senior_citizen">Senior Citizen</option>
            <option value="women">Women</option>
            <option value="sc_st">SC/ST</option>
            <option value="obc">OBC</option>
            <option value="general">General</option>
            <option value="bpl">Below Poverty Line (BPL)</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <button type="submit" disabled={loading} className="civis-btn w-full rounded-full text-lg py-4">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running Agent Pipeline…
            </span>
          ) : "Check Eligibility"}
        </button>
      </form>

      {/* ── Results ── */}
      {result?.kind === "success" && (
        <PipelineResults
          data={result.data}
          savedToDB={savedToDB}
          isVerified={isVerified}
          appliedSchemes={appliedSchemes}
          appsRefreshing={appsRefreshing}
          onViewDetails={(s) => setDetailScheme(s)}
          onApply={(s) => setApplyScheme(s)}
          onRefreshApps={refreshApps}
        />
      )}

      {result?.kind === "plain" && (
        <div className="mt-8 bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black text-xl uppercase mb-4">Agent Response</h3>
          <pre className="text-sm bg-white p-4 rounded-xl border-2 border-black font-mono whitespace-pre-wrap">{result.text}</pre>
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-8 bg-[#ff5c8d] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#ff5c8d] font-black">✗</div>
            <h3 className="font-black text-xl uppercase">Could not get results</h3>
          </div>
          <p className="font-bold text-sm text-black/80">{result.message}</p>
          <p className="font-bold text-xs text-black/50 mt-2 italic">Please try again in a moment. Our servers may be starting up.</p>
        </div>
      )}

      {/* ── Modals ── */}
      {detailScheme && (
        <SchemeDetailModal
          scheme={detailScheme}
          isPartialMatch={!detailScheme.eligible}
          onClose={() => setDetailScheme(null)}
          onApply={(s) => { setDetailScheme(null); setApplyScheme(s); }}
        />
      )}
      {applyScheme && (
        <ApplyModal
          scheme={applyScheme}
          citizenData={citizenData}
          citizenId={citizenId}
          onClose={() => setApplyScheme(null)}
          onApplied={handleApplied}
        />
      )}
    </div>
  );
}

// ── Sub-component: full pipeline results ─────────────────────────────────────
function PipelineResults({
  data,
  savedToDB,
  isVerified,
  appliedSchemes,
  appsRefreshing,
  onViewDetails,
  onApply,
  onRefreshApps,
}: {
  data: AgentPipelineResponse;
  savedToDB: boolean;
  isVerified: boolean;
  appliedSchemes: Record<string, { application_id: string; scheme_name: string; status: string; submitted_at?: string }>;
  appsRefreshing: boolean;
  onViewDetails: (s: RankedScheme) => void;
  onApply: (s: RankedScheme) => void;
  onRefreshApps: () => void;
}) {
  const { summary, ranked_schemes, pipeline, vc, total_eligible, partial_matches } = data;
  const isPartial = partial_matches === true || total_eligible === 0;

  return (
    <div className="mt-8 space-y-8">
      {/* Summary banner */}
      <div className={`border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${isPartial ? "bg-orange-50" : "bg-[#d9ff00]"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl border-3 border-black ${isPartial ? "bg-orange-300" : "bg-black text-[#d9ff00]"}`}>
            {isPartial ? "~" : total_eligible}
          </div>
          <div className="flex-1">
            <h3 className="font-black text-2xl uppercase tracking-tight">
              {isPartial ? "Near Matches Found" : "Eligibility Result"}
            </h3>
            <p className="font-bold text-black/70 text-sm mt-0.5">{summary}</p>
          </div>
          {savedToDB && (
            <span className="text-[10px] font-black uppercase bg-black text-[#d9ff00] px-3 py-1 rounded-full">Saved to DB</span>
          )}
        </div>

        {/* Pipeline status pills */}
        {pipeline && pipeline.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {pipeline.map((step) => (
              <span
                key={step.step}
                className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border-2 border-black ${step.ok ? "bg-black text-[#d9ff00]" : "bg-white text-red-600"}`}
              >
                {step.ok ? "✓" : "✗"} {PIPELINE_LABELS[step.step] ?? step.step}
                {step.count !== undefined && step.count !== null ? ` (${step.count})` : ""}
              </span>
            ))}
          </div>
        )}

        {isPartial && (
          <p className="mt-3 text-sm font-bold text-orange-700 bg-orange-100 border border-orange-300 rounded-xl px-3 py-2">
            No schemes perfectly matched your profile. Showing nearest matches below — adjust your category or income to improve results.
          </p>
        )}
      </div>

      {/* Scheme cards */}
      {ranked_schemes && ranked_schemes.length > 0 ? (
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-black/40 mb-4">
            {isPartial ? "Nearest Partial Matches" : "Eligible Schemes — Ranked by Relevance"}
          </h4>
          {/* Identity gate */}
          {!isVerified && (
            <div className="flex items-start gap-3 bg-[#ff5c8d] border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-2">
              <span className="text-2xl mt-0.5">🔒</span>
              <div>
                <p className="font-black uppercase text-sm">Identity Not Verified</p>
                <p className="text-xs font-bold text-black/70 mt-0.5">
                  Your Verifiable Credential could not be saved (agents may be offline). You must verify your identity before applying.
                  Re-submit the form when all agents are running to get verified.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(ranked_schemes as RankedScheme[]).map((scheme: RankedScheme) => (
              <SchemeCard
                key={scheme.scheme_id}
                name={scheme.name}
                description={scheme.description}
                eligibility={scheme.eligibility_text}
                benefits={scheme.benefits}
                index={(scheme.rank ?? 1) - 1}
                score={scheme.relevance_score}
                reasons={scheme.reasons_pass}
                isPartialMatch={isPartial || !scheme.eligible}
                isApplied={!!appliedSchemes[scheme.scheme_id]}
                applicationStatus={appliedSchemes[scheme.scheme_id]?.status}
                onDetails={() => onViewDetails(scheme)}
                onApply={(scheme.eligible && isVerified && !appliedSchemes[scheme.scheme_id]) ? () => onApply(scheme) : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-bold text-center text-black/50">No schemes found for your profile.</p>
        </div>
      )}

      {/* VC Badge */}
      {vc && !isPartial && <VCBadge vc={vc} />}

      {/* My Applications Panel */}
      <MyApplicationsPanel
        apps={Object.values(appliedSchemes)}
        loading={appsRefreshing}
        onRefresh={onRefreshApps}
      />
    </div>
  );
}

// ── Sub-component: My Applications tracker ───────────────────────────────────
const STATUS_BADGE_PANEL: Record<string, { label: string; cls: string }> = {
  started:             { label: "Started",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
  documents_submitted: { label: "Docs Submitted", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  under_review:        { label: "Under Review",   cls: "bg-yellow-100 text-yellow-800 border-yellow-400" },
  approved:            { label: "Approved ✓",     cls: "bg-green-100 text-green-700 border-green-400" },
  rejected:            { label: "Rejected",       cls: "bg-red-100 text-red-700 border-red-300" },
};

function MyApplicationsPanel({
  apps,
  loading,
  onRefresh,
}: {
  apps: { application_id: string; scheme_name: string; status: string; submitted_at?: string }[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (apps.length === 0) return null;

  return (
    <div className="mt-8 border-4 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="bg-black px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#d9ff00] text-base">📋</span>
          <h3 className="font-black uppercase text-[#d9ff00] text-sm tracking-wider">My Applications</h3>
          <span className="bg-[#d9ff00] text-black text-[10px] font-black px-2 py-0.5 rounded-full">{apps.length}</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[10px] uppercase font-black text-[#d9ff00] bg-[#d9ff00]/10 border border-[#d9ff00]/30 px-3 py-1 rounded-full hover:bg-[#d9ff00]/20 transition-colors disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "↻ Refresh Status"}
        </button>
      </div>

      {/* Application rows */}
      <div className="bg-white divide-y-2 divide-black/10">
        {apps.map((app) => {
          const badge = STATUS_BADGE_PANEL[app.status] ?? { label: app.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
          const dateStr = app.submitted_at
            ? new Date(app.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : null;
          return (
            <div key={app.application_id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm uppercase tracking-tight truncate">{app.scheme_name}</p>
                <p className="font-mono text-[10px] text-black/40 mt-0.5">
                  ID: {String(app.application_id).toUpperCase().slice(0, 18)}
                  {dateStr && <span className="ml-2 text-black/30">· {dateStr}</span>}
                </p>
              </div>
              <span className={`text-[10px] font-black uppercase border-2 px-2.5 py-1 rounded-full flex-shrink-0 ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
