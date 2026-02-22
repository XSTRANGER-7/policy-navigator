"use client";

import { useState } from "react";
import Link from "next/link";
import VCBadge from "@/components/VCBadge";
import type { VerifiableCredential } from "@/types/credential";

// ─── Types ──────────────────────────────────────────────────────────────────
interface VerifyResult {
  verified: boolean;
  role: string;
  email?: string;
  citizen_id?: string;
  profile?: { age: number; state: string; category: string };
  verified_at?: string;
  has_vc?: boolean;
  citizen_did?: string;
  total_eligible?: number;
  schemes?: { id: string; name: string }[];
  vc_issued_at?: string;
  vc_expires_at?: string;
  vc_json?: VerifiableCredential;
  full_name?: string;
  organisation?: string;
  auth_id?: string;
  message?: string;
  error?: string;
}

interface Application {
  id: string;
  scheme_id: string;
  scheme_name: string;
  status: string;
  notes?: string;
  submitted_at: string;
  reviewed_at?: string;
  citizen_id?: string;
  citizens?: { email: string; age: number; state: string; category: string; verified: boolean };
}

const STATUS_COLORS: Record<string, string> = {
  started:              "bg-blue-100 text-blue-800",
  documents_submitted:  "bg-yellow-100 text-yellow-800",
  under_review:         "bg-orange-100 text-orange-800",
  approved:             "bg-green-100 text-green-800",
  rejected:             "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  started:              "Started",
  documents_submitted:  "Docs Submitted",
  under_review:         "Under Review",
  approved:             "Approved ✓",
  rejected:             "Rejected ✗",
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <section className="px-6 py-16 md:px-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-[#ff5c8d] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-5">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          TRUST PORTAL
        </div>
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          VERIFY<br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">IDENTITY.</span>
        </h1>
        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** Enter your email to retrieve your Verifiable Credential and track applications.
        </p>
      </div>

      {/* Agency CTA */}
      <div className="mb-8 bg-black text-white border-4 border-black rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)]">
        <div>
          <p className="font-black uppercase text-sm">Are you a Government Agency or NGO?</p>
          <p className="text-white/50 text-xs font-bold mt-0.5">Register your organisation and access the full review portal.</p>
        </div>
        <Link href="/agency" className="bg-[#d9ff00] text-black border-2 border-[#d9ff00] px-5 py-2.5 rounded-full font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(255,255,255,0.15)] hover:opacity-90 whitespace-nowrap">
          🏛 Agency Portal →
        </Link>
      </div>

      <CitizenTab />
    </section>
  );
}

// ─── Citizen Tab ─────────────────────────────────────────────────────────────
function CitizenTab() {
  const [email, setEmail]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<VerifyResult | null>(null);
  const [apps, setApps]             = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  async function lookup() {
    const q = email.trim().toLowerCase();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setApps([]);

    const res  = await fetch(`/api/verify?email=${encodeURIComponent(q)}&role=citizen`);
    const data = await res.json() as VerifyResult;
    setResult(data);
    setLoading(false);

    // Also fetch applications
    if (data.citizen_id || data.email) {
      setAppsLoading(true);
      const appsRes  = await fetch(`/api/applications?email=${encodeURIComponent(q)}`);
      const appsData = await appsRes.json();
      setApps(appsData.applications ?? []);
      setAppsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "📝", step: "01", title: "Submit Eligibility Form", desc: "Go to the Citizens page & fill your details — email, age, income, state, category." },
          { icon: "🤖", step: "02", title: "AI Issues Your VC", desc: "The Credential Agent generates a W3C Verifiable Credential with your DID and eligible schemes." },
          { icon: "🔐", step: "03", title: "Verify & Apply", desc: "Come back here — enter your email to retrieve your VC and apply for schemes." },
        ].map((s) => (
          <div key={s.step} className="bg-white border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-[10px] font-black text-black/30">STEP {s.step}</span>
            </div>
            <div className="font-black uppercase text-sm mb-1">{s.title}</div>
            <div className="text-xs font-bold text-black/60">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Lookup input */}
      <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-3">
          Your Email (same one used in the eligibility form)
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="civis-input flex-1 rounded-lg"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button
            onClick={lookup}
            disabled={loading || !email.trim()}
            className="civis-btn rounded-full whitespace-nowrap px-8"
          >
            {loading ? "Checking…" : "Verify Identity →"}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <>
          {result.error ? (
            <ErrorCard message={result.error} />
          ) : result.verified ? (
            <VerifiedBadge result={result} />
          ) : (
            <NotVerifiedCard message={result.message ?? "Run the eligibility pipeline to get your VC."} />
          )}

          {/* VC Badge */}
          {result.vc_json && <VCBadge vc={result.vc_json} />}

          {/* Applications */}
          {result.verified && (
            <ApplicationsTable
              apps={apps}
              loading={appsLoading}
              role="citizen"
            />
          )}
        </>
      )}

      {!result && !loading && (
        <div className="text-center py-16 border-4 border-dashed border-black/20 rounded-3xl">
          <div className="text-5xl mb-3">🔍</div>
          <p className="font-black uppercase text-black/30 text-sm tracking-widest">Enter your email above</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerifiedBadge({ result }: { result: VerifyResult }) {
  return (
    <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 bg-black text-[#d9ff00] rounded-full flex items-center justify-center font-black text-xl">✓</div>
        <div className="flex-1">
          <p className="font-black text-2xl uppercase tracking-tight">Identity Verified</p>
          <p className="text-xs font-bold text-black/60 mt-0.5 font-mono">{result.email}</p>
        </div>
        <span className="bg-black text-[#d9ff00] text-[10px] font-black uppercase px-4 py-1.5 rounded-full">
          VC ISSUED ✓
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Citizen ID",  value: result.citizen_id?.slice(0, 8) + "…" },
          { label: "DID",         value: result.citizen_did?.slice(0, 16) + "…" },
          { label: "Eligible",    value: `${result.total_eligible ?? 0} schemes` },
          { label: "VC Issued",   value: result.vc_issued_at ? new Date(result.vc_issued_at).toLocaleDateString() : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-black/10 rounded-xl p-3">
            <div className="text-[9px] font-black uppercase text-black/40">{label}</div>
            <div className="font-black text-sm mt-0.5 truncate font-mono">{value}</div>
          </div>
        ))}
      </div>
      {(result.schemes ?? []).length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-black/40 mb-2">Eligible Schemes</p>
          <div className="flex flex-wrap gap-2">
            {(result.schemes ?? []).slice(0, 6).map((s) => (
              <span key={s.id} className="bg-black text-[#d9ff00] text-[10px] font-black px-3 py-1 rounded-full">
                {s.name || s.id}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex gap-3 flex-wrap">
        <Link href="/eligibility" className="text-[11px] font-black uppercase border-2 border-black px-4 py-2 rounded-full hover:bg-black hover:text-[#d9ff00] transition-colors">
          Check Eligibility Again →
        </Link>
        <Link href="/policies" className="text-[11px] font-black uppercase border-2 border-black px-4 py-2 rounded-full hover:bg-black hover:text-[#d9ff00] transition-colors">
          Browse Schemes →
        </Link>
      </div>
    </div>
  );
}

function NotVerifiedCard({ message, ctaHref = "/eligibility", ctaLabel = "Check Eligibility Now" }: { message: string; ctaHref?: string; ctaLabel?: string }) {
  return (
    <div className="bg-[#ff5c8d] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-black text-[#ff5c8d] rounded-full flex items-center justify-center font-black text-sm">✗</div>
        <p className="font-black text-lg uppercase">Not Verified</p>
      </div>
      <p className="text-sm font-bold text-black/80 mt-1">{message}</p>
      <Link href={ctaHref} className="inline-block mt-4 bg-black text-[#d9ff00] text-[11px] font-black uppercase px-5 py-2 rounded-full hover:opacity-80">
        {ctaLabel} →
      </Link>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-[#ff5c8d] border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <p className="font-black uppercase text-sm">⚠ Error</p>
      <p className="text-sm font-bold mt-1">{message}</p>
    </div>
  );
}

function ApplicationsTable({
  apps,
  loading,
  role,
  onStatusChange,
}: {
  apps: Application[];
  loading: boolean;
  role: "citizen" | "agency";
  onStatusChange?: (id: string, status: string, notes?: string) => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      <div className="px-6 py-4 border-b-4 border-black bg-zinc-50 flex items-center justify-between">
        <h3 className="font-black uppercase tracking-tight">
          {role === "citizen" ? "Your Applications" : "All Applications (Agency View)"}
        </h3>
        <span className="text-xs font-black text-black/40">{apps.length} total</span>
      </div>

      {apps.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-black uppercase text-black/30 text-sm">No applications yet</p>
          {role === "citizen" && (
            <Link href="/eligibility" className="inline-block mt-3 text-[11px] font-black uppercase border-2 border-black px-4 py-2 rounded-full hover:bg-[#d9ff00]">
              Check Eligibility to Apply →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-zinc-50">
                {role === "agency" && <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-black/50">Citizen</th>}
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-black/50">Scheme</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-black/50">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-black/50">Submitted</th>
                {role === "agency" && <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-black/50">Update</th>}
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-black/10 hover:bg-zinc-50">
                  {role === "agency" && (
                    <td className="px-4 py-3">
                      <div className="font-bold text-xs">{a.citizens?.email ?? "—"}</div>
                      <div className="text-[10px] text-black/40">{a.citizens?.category} · {a.citizens?.verified ? "✓ Verified" : "Unverified"}</div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="font-black text-sm">{a.scheme_name}</div>
                    <div className="text-[10px] text-black/40 font-mono">{a.scheme_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-black/50 font-bold">
                    {new Date(a.submitted_at).toLocaleDateString("en-IN")}
                  </td>
                  {role === "agency" && onStatusChange && (
                    <td className="px-4 py-3">
                      <select
                        disabled={updatingId === a.id}
                        value={a.status}
                        onChange={async (e) => {
                          setUpdatingId(a.id);
                          await onStatusChange(a.id, e.target.value);
                          setUpdatingId(null);
                        }}
                        className="text-[11px] font-black border-2 border-black rounded-lg px-2 py-1 bg-white cursor-pointer"
                      >
                        <option value="started">Started</option>
                        <option value="documents_submitted">Docs Submitted</option>
                        <option value="under_review">Under Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
