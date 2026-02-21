"use client";

import { useState } from "react";
import type { RankedScheme } from "@/types/scheme";
import type { Application, ApplicationStatus } from "@/types/citizen";

interface ApplyModalProps {
  scheme: RankedScheme;
  citizenData: { age: number; income: number; state: string; category: string; email?: string };
  citizenId?: string | null;
  onClose: () => void;
}

const STATUS_STEPS: { key: ApplicationStatus; label: string; desc: string }[] = [
  { key: "started",             label: "Application Started",  desc: "Your application has been created" },
  { key: "documents_submitted", label: "Docs Submitted",       desc: "Documents submitted for review" },
  { key: "under_review",        label: "Under Review",         desc: "Officials are verifying your case" },
  { key: "approved",            label: "Approved",             desc: "Application approved!" },
];

export default function ApplyModal({ scheme, citizenData, citizenId, onClose }: ApplyModalProps) {
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<Application | null>(null);
  const [error, setError]       = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  // Step 1: Fetch required docs on mount
  useState(() => {
    fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_docs", scheme_id: scheme.scheme_id, category: citizenData.category }),
    })
      .then((r) => r.json())
      .then((d) => setRequiredDocs(d.required_docs ?? []))
      .catch(() => setRequiredDocs(["Aadhaar Card", "Income Certificate", "Bank Account"]));
  });

  async function submitApplication() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      "submit",
          scheme_id:   scheme.scheme_id,
          scheme_name: scheme.name,
          category:    citizenData.category,
          age:         citizenData.age,
          income:      citizenData.income,
          state:       citizenData.state,
          citizen_id:  citizenId ?? null,
          docs:        { confirmed: true, required_docs: requiredDocs },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult(data);
      setStep(3);
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to submit");
    }
    setLoading(false);
  }

  const currentStatusIndex = result
    ? STATUS_STEPS.findIndex((s) => s.key === result.status)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#e4e4db] border-4 border-black rounded-t-3xl sm:rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="sticky top-0 bg-[#e4e4db] border-b-4 border-black px-6 pt-5 pb-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5">
              Apply — Step {step} of 3
            </p>
            <h2 className="font-black text-xl uppercase tracking-tight">{scheme.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-black text-lg hover:bg-black/70"
          >
            ×
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1.5 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? "bg-black" : "bg-black/20"
              }`}
            />
          ))}
        </div>

        <div className="px-6 py-5">
          {/* ── Step 1: Documents checklist ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg uppercase mb-1">Documents Required</h3>
                <p className="text-sm font-bold text-black/50">
                  Keep these documents ready before applying. Originals + 1 photocopy each.
                </p>
              </div>

              <ul className="space-y-2">
                {(requiredDocs.length ? requiredDocs : ["Aadhaar Card", "Income Certificate", "Bank Account"]).map(
                  (doc, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 bg-white border-2 border-black rounded-xl px-4 py-3"
                    >
                      <span className="w-7 h-7 rounded-full bg-[#d9ff00] border-2 border-black flex items-center justify-center text-xs font-black">
                        {i + 1}
                      </span>
                      <span className="font-bold text-sm">{doc}</span>
                    </li>
                  ),
                )}
              </ul>

              <label className="flex items-start gap-3 bg-[#d9ff00] border-3 border-black rounded-2xl p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-black"
                />
                <span className="font-bold text-sm">
                  I confirm I have these documents and will submit them when required by the scheme authority.
                </span>
              </label>

              <button
                onClick={() => setStep(2)}
                disabled={!confirmed}
                className="civis-btn w-full rounded-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2: Confirm & Submit ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-lg uppercase mb-1">Review and Submit</h3>
                <p className="text-sm font-bold text-black/50">
                  Confirm your profile details and submit the application.
                </p>
              </div>

              {/* Profile summary */}
              <div className="bg-white border-3 border-black rounded-2xl p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Age",       value: citizenData.age },
                  { label: "Income",    value: `₹${Number(citizenData.income).toLocaleString("en-IN")}` },
                  { label: "State",     value: citizenData.state || "—" },
                  { label: "Category",  value: citizenData.category || "General" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-black uppercase text-black/40">{label}</p>
                    <p className="font-black capitalize">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#d9ff00] border-3 border-black rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase text-black/40 mb-1">Applying for</p>
                <p className="font-black text-lg">{scheme.name}</p>
                <p className="font-bold text-black/60 text-sm mt-1">{scheme.benefits}</p>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-700 font-bold text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3 bg-white border-3 border-black rounded-full font-black uppercase text-sm hover:bg-black/5 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={submitApplication}
                  disabled={loading}
                  className="flex-1 civis-btn rounded-full py-3"
                >
                  {loading ? "Submitting…" : "Submit Application →"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Application status ── */}
          {step === 3 && result && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#d9ff00] border-4 border-black rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                  ✓
                </div>
                <h3 className="font-black text-xl uppercase">Application Submitted!</h3>
                <p className="font-bold text-black/50 text-sm mt-1">{result.message}</p>
              </div>

              {/* Application ID */}
              <div className="bg-black text-[#d9ff00] rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Application ID</p>
                <p className="font-black text-lg tracking-widest">{String(result.application_id).toUpperCase().slice(0, 12)}</p>
                <p className="text-[10px] font-bold opacity-50 mt-1">Save this for tracking</p>
              </div>

              {/* Status timeline */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-black/40 mb-3">
                  Application Progress
                </p>
                <div className="space-y-0">
                  {STATUS_STEPS.map((s, idx) => {
                    const done    = idx <= currentStatusIndex;
                    const current = idx === currentStatusIndex;
                    return (
                      <div key={s.key} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full border-3 flex items-center justify-center text-xs font-black flex-shrink-0 ${
                              done ? "bg-black border-black text-[#d9ff00]" : "bg-white border-black/30 text-black/30"
                            }`}
                          >
                            {done ? "✓" : idx + 1}
                          </div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={`w-0.5 h-6 ${done ? "bg-black" : "bg-black/20"}`} />
                          )}
                        </div>
                        {/* Label */}
                        <div className="pb-4">
                          <p className={`font-black text-sm ${current ? "text-black" : done ? "text-black/60" : "text-black/30"}`}>
                            {s.label}
                            {current && (
                              <span className="ml-2 text-[9px] bg-[#d9ff00] border border-black px-1.5 py-0.5 rounded-full uppercase">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-xs font-bold text-black/40">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next steps */}
              {result.next_steps && result.next_steps.length > 0 && (
                <div className="bg-white border-3 border-black rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Next Steps</p>
                  <ol className="space-y-2">
                    {result.next_steps.map((ns, i) => (
                      <li key={i} className="flex gap-2 text-sm font-bold text-black/70">
                        <span className="font-black text-black">{i + 1}.</span> {ns}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full bg-black text-[#d9ff00] font-black uppercase py-3 rounded-full text-sm hover:bg-black/80 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
