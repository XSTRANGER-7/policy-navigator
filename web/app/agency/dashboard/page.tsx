"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
interface AgencySession {
  agency_id:      string;
  org_name:       string;
  org_type:       string;
  state:          string;
  contact_person: string;
  email:          string;
  stats: { total: number; pending: number; approved: number; rejected: number };
}

interface Application {
  id:           string;
  scheme_id:    string;
  scheme_name:  string;
  status:       string;
  notes?:       string;
  submitted_at: string;
  reviewed_at?: string;
  citizen_id?:  string;
  citizens?: {
    email:     string;
    age:       number;
    state:     string;
    category:  string;
    verified:  boolean;
  };
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  started:             { label: "Started",        color: "bg-blue-100 text-blue-800 border-blue-200" },
  documents_submitted: { label: "Docs Submitted", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  under_review:        { label: "Under Review",   color: "bg-orange-100 text-orange-800 border-orange-200" },
  approved:            { label: "Approved ✓",     color: "bg-green-100 text-green-800 border-green-200" },
  rejected:            { label: "Rejected ✗",     color: "bg-red-100 text-red-800 border-red-200" },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border-3 border-black p-4 ${accent} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}>
      <p className="font-black text-3xl">{value}</p>
      <p className="font-black text-xs uppercase tracking-wider text-black/60 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({
  app, onClose, onSave,
}: {
  app: Application;
  onClose: () => void;
  onSave: (id: string, status: string, notes: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(app.status);
  const [notes, setNotes]   = useState(app.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(app.id, status, notes);
    setSaving(false);
    onClose();
  }

  const c = app.citizens;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-4 border-black rounded-2xl p-6 w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-black text-xl uppercase">{app.scheme_name || app.scheme_id}</h2>
            <p className="text-xs font-bold text-black/40">Application ID: {app.id.slice(0, 8)}…</p>
          </div>
          <button onClick={onClose} className="text-black/40 hover:text-black font-black text-xl">✕</button>
        </div>

        {/* Citizen profile */}
        {c && (
          <div className="bg-black/5 rounded-xl p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-black/40 mb-2">Citizen Details</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-bold text-black/50">Email: </span><span className="font-black">{c.email}</span></div>
              <div><span className="font-bold text-black/50">Age: </span><span className="font-black">{c.age}</span></div>
              <div><span className="font-bold text-black/50">State: </span><span className="font-black">{c.state}</span></div>
              <div><span className="font-bold text-black/50">Category: </span><span className="font-black capitalize">{c.category}</span></div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {c.verified ? (
                <span className="inline-flex items-center gap-1.5 bg-green-100 border border-green-300 text-green-800 font-black text-xs px-3 py-1 rounded-full">
                  <span>✓</span> Identity VC Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-yellow-50 border border-yellow-300 text-yellow-800 font-bold text-xs px-3 py-1 rounded-full">
                  ⚠ Not Yet Verified
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status selector */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
            Update Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`border-2 rounded-xl px-3 py-2.5 text-xs font-black uppercase text-left transition-all ${
                  status === key
                    ? `${color} border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`
                    : "border-black/20 bg-white text-black/50 hover:border-black/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
            Review Notes
          </label>
          <textarea
            className="civis-input w-full rounded-xl resize-none text-sm"
            rows={3}
            placeholder="Add any notes, requirements, or reasons for decision…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-black text-[#d9ff00] font-black uppercase rounded-full py-3 text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Decision →"}
          </button>
          <button
            onClick={onClose}
            className="px-5 border-2 border-black rounded-full font-black text-sm hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AgencyDashboard() {
  const router = useRouter();

  const [session, setSession]         = useState<AgencySession | null>(null);
  const [apps, setApps]               = useState<Application[]>([]);
  const [filtered, setFiltered]       = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterState, setFilterState]   = useState("all");
  const [searchQ, setSearchQ]           = useState("");
  const [reviewApp, setReviewApp]       = useState<Application | null>(null);
  const [stats, setStats]               = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem("agency_session");
    if (!raw) { router.replace("/agency"); return; }
    try {
      const s: AgencySession = JSON.parse(raw);
      setSession(s);
      setStats(s.stats ?? { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch {
      router.replace("/agency");
    }
  }, [router]);

  // ── Load all applications ───────────────────────────────────────────────────
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const res  = await fetch("/api/applications?role=agency");
      const data = await res.json();
      const list: Application[] = data.applications ?? [];
      setApps(list);
      setFiltered(list);

      // Recompute stats from live data
      setStats({
        total:    list.length,
        pending:  list.filter((a) => a.status === "under_review").length,
        approved: list.filter((a) => a.status === "approved").length,
        rejected: list.filter((a) => a.status === "rejected").length,
      });
    } catch {/* ignore */}
    finally { setLoadingApps(false); }
  }, []);

  useEffect(() => { if (session) loadApps(); }, [session, loadApps]);

  // ── Filter logic ────────────────────────────────────────────────────────────
  useEffect(() => {
    let list = [...apps];
    if (filterStatus !== "all") list = list.filter((a) => a.status === filterStatus);
    if (filterState  !== "all") list = list.filter((a) => a.citizens?.state === filterState);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((a) =>
        a.citizens?.email.toLowerCase().includes(q) ||
        a.scheme_id.toLowerCase().includes(q) ||
        (a.scheme_name ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [apps, filterStatus, filterState, searchQ]);

  // ── Save review decision ────────────────────────────────────────────────────
  async function saveDecision(id: string, status: string, notes: string) {
    const res = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: id, status, notes }),
    });
    if (res.ok) {
      setApps((prev) => prev.map((a) => a.id === id ? { ...a, status, notes } : a));
    }
  }

  function signOut() {
    sessionStorage.removeItem("agency_session");
    router.push("/agency");
  }

  // ── Unique states for filter ────────────────────────────────────────────────
  const uniqueStates = Array.from(new Set(apps.map((a) => a.citizens?.state).filter(Boolean))) as string[];

  if (!session) return null; // loading / redirecting

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Agency Header */}
      <div className="bg-black text-white px-6 md:px-12 py-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Agency Portal</p>
          <h1 className="font-black text-2xl uppercase leading-none">{session.org_name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-white/10 text-white/70 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
              {session.org_type}
            </span>
            <span className="bg-white/10 text-white/70 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
              {session.state}
            </span>
            <span className="bg-[#d9ff00] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
              {session.agency_id}
            </span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-xs font-black uppercase border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Applications" value={stats.total}    accent="bg-white" />
          <StatCard label="Under Review"        value={stats.pending}  accent="bg-orange-50" />
          <StatCard label="Approved"            value={stats.approved} accent="bg-green-50" />
          <StatCard label="Rejected"            value={stats.rejected} accent="bg-red-50" />
        </div>

        {/* Filters */}
        <div className="bg-white border-3 border-black rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <input
            className="civis-input rounded-lg text-sm flex-1 min-w-[180px]"
            placeholder="Search by citizen email or scheme…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <select
            className="civis-input rounded-lg text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            className="civis-input rounded-lg text-sm"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
          >
            <option value="all">All States</option>
            {uniqueStates.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={loadApps}
            className="border-2 border-black rounded-full px-4 py-2 font-black text-xs uppercase hover:bg-black hover:text-white transition-colors"
          >
            ↻ Refresh
          </button>
          <p className="text-xs font-bold text-black/40 ml-auto">
            Showing {filtered.length} of {apps.length} applications
          </p>
        </div>

        {/* Applications Table */}
        <div className="bg-white border-3 border-black rounded-2xl overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          {loadingApps ? (
            <div className="p-12 text-center font-black text-black/30 uppercase">Loading applications…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-black text-lg uppercase">No applications found</p>
              <p className="font-bold text-black/40 text-sm mt-1">
                {apps.length === 0
                  ? "Citizens haven't submitted applications yet."
                  : "Try adjusting filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-[#d9ff00]">
                    {["Citizen", "Age", "State", "Category", "Scheme", "Submitted", "VC", "Status", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-black text-xs uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app, i) => {
                    const cfg = STATUS_CONFIG[app.status] ?? { label: app.status, color: "bg-gray-100 text-gray-700 border-gray-200" };
                    return (
                      <tr
                        key={app.id}
                        className={`border-b border-black/10 hover:bg-black/2 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-black/[0.02]"}`}
                      >
                        <td className="px-4 py-3 font-bold max-w-[160px] truncate" title={app.citizens?.email}>
                          {app.citizens?.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-bold">{app.citizens?.age ?? "—"}</td>
                        <td className="px-4 py-3 font-bold whitespace-nowrap">{app.citizens?.state ?? "—"}</td>
                        <td className="px-4 py-3 font-bold capitalize">{app.citizens?.category ?? "—"}</td>
                        <td className="px-4 py-3 font-bold text-xs max-w-[140px] truncate" title={app.scheme_name || app.scheme_id}>
                          {app.scheme_name || app.scheme_id}
                        </td>
                        <td className="px-4 py-3 text-black/50 font-bold text-xs whitespace-nowrap">
                          {new Date(app.submitted_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          {app.citizens?.verified ? (
                            <span className="inline-block bg-green-100 text-green-800 border border-green-200 font-black text-[10px] px-2 py-0.5 rounded-full">✓ VC</span>
                          ) : (
                            <span className="inline-block bg-gray-100 text-gray-500 font-black text-[10px] px-2 py-0.5 rounded-full">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block border font-black text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setReviewApp(app)}
                            className="bg-black text-[#d9ff00] font-black text-[10px] uppercase px-3 py-1.5 rounded-full hover:opacity-80 transition-opacity whitespace-nowrap"
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {reviewApp && (
        <ReviewModal
          app={reviewApp}
          onClose={() => setReviewApp(null)}
          onSave={saveDecision}
        />
      )}
    </div>
  );
}
