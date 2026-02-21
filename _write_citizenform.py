"""Write updated CitizenForm.tsx — run once"""

NEW_CITIZEN_FORM = '''\
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

export default function CitizenForm() {
  const [form, setForm] = useState({
    email: "", age: "", income: "", state: "", category: "",
  });
  const [loading, setLoading]     = useState(false);
  const [savedToDB, setSavedToDB] = useState(false);
  const [result, setResult]       = useState<ResultState>(null);

  // Modal state
  const [detailScheme, setDetailScheme] = useState<RankedScheme | null>(null);
  const [applyScheme,  setApplyScheme]  = useState<RankedScheme | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setSavedToDB(false);

    // 1. Save citizen (best-effort)
    try {
      const r = await fetch("/api/citizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, age: Number(form.age), income: Number(form.income) }),
      });
      const d = await r.json();
      if (!d.error) setSavedToDB(true);
    } catch { /* Supabase not configured */ }

    // 2. Call agent pipeline
    try {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Number(form.age), income: Number(form.income),
          state: form.state, category: form.category,
        }),
      });
      const d = await r.json();

      if (!r.ok) {
        setResult({ kind: "error", message: d.error || "Agent returned an error" });
      } else {
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
          onViewDetails={(s) => setDetailScheme(s)}
          onApply={(s) => setApplyScheme(s)}
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
          <p className="font-bold text-xs text-black/50 mt-2 italic">Make sure the agents are running locally (ports 5000–5005).</p>
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
          onClose={() => setApplyScheme(null)}
        />
      )}
    </div>
  );
}

// ── Sub-component: full pipeline results ─────────────────────────────────────
function PipelineResults({
  data,
  savedToDB,
  onViewDetails,
  onApply,
}: {
  data: AgentPipelineResponse;
  savedToDB: boolean;
  onViewDetails: (s: RankedScheme) => void;
  onApply: (s: RankedScheme) => void;
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
                onDetails={() => onViewDetails(scheme)}
                onApply={scheme.eligible ? () => onApply(scheme) : undefined}
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
    </div>
  );
}
'''

with open("web/components/CitizenForm.tsx", "w", encoding="utf-8") as f:
    f.write(NEW_CITIZEN_FORM)
print("CitizenForm.tsx written:", len(NEW_CITIZEN_FORM.splitlines()), "lines")
