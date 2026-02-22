"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ORG_TYPES = [
  "Government Body",
  "Ministry",
  "Department",
  "NGO",
  "Municipal Corporation",
  "District Office",
  "Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh",
];

// ─── Register Form ────────────────────────────────────────────────────────────
function RegisterForm() {
  const [form, setForm] = useState({
    org_name: "", org_type: "", state: "",
    reg_number: "", contact_person: "", email: "", purpose: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ agency_id: string; org_name: string; email: string } | null>(null);
  const [error, setError]     = useState("");

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed"); return; }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        {/* Success card */}
        <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-black text-2xl uppercase">Registration Successful</h2>
          <p className="font-bold text-black/60 text-sm mt-1">
            Your agency has been registered on CIVIS AI. Save your credentials securely.
          </p>
        </div>

        <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-black/40">Organisation</p>
            <p className="font-black text-lg">{result.org_name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-black/40">Official Email</p>
            <p className="font-bold">{result.email}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-black/40 mb-1">Your Agency ID</p>
            <div className="flex items-center gap-3 bg-black text-[#d9ff00] rounded-xl px-5 py-3">
              <span className="font-black text-2xl tracking-widest">{result.agency_id}</span>
              <button
                onClick={() => navigator.clipboard.writeText(result.agency_id)}
                className="ml-auto text-xs font-black border border-[#d9ff00]/50 rounded-lg px-3 py-1 hover:bg-[#d9ff00] hover:text-black transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-[11px] font-bold text-black/40 mt-1.5">
              ⚠ Keep this ID secure. You will need it to access the Agency Portal every time.
            </p>
          </div>
          <Link
            href="/agency/dashboard"
            className="block w-full text-center bg-black text-[#d9ff00] font-black uppercase rounded-full py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            Go to Agency Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border-4 border-black rounded-2xl p-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Organisation Name *
          </label>
          <input
            className="civis-input w-full rounded-lg"
            placeholder="Ministry of Agriculture, District NIC Office, Jan Seva NGO…"
            value={form.org_name}
            onChange={(e) => set("org_name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Organisation Type *
          </label>
          <select
            className="civis-input w-full rounded-lg"
            value={form.org_type}
            onChange={(e) => set("org_type", e.target.value)}
            required
          >
            <option value="">Select type…</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            State / UT *
          </label>
          <select
            className="civis-input w-full rounded-lg"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            required
          >
            <option value="">Select state…</option>
            {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Registration / License Number
          </label>
          <input
            className="civis-input w-full rounded-lg"
            placeholder="e.g. FCRA-0123456 (optional)"
            value={form.reg_number}
            onChange={(e) => set("reg_number", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Contact Person *
          </label>
          <input
            className="civis-input w-full rounded-lg"
            placeholder="Name of the authorised representative"
            value={form.contact_person}
            onChange={(e) => set("contact_person", e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Official Email Address *
          </label>
          <input
            className="civis-input w-full rounded-lg"
            type="email"
            placeholder="official@ministry.gov.in"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          <p className="text-[10px] font-bold text-black/40 mt-1">
            Use an official government or organisation email address.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
            Purpose / Scope of Use
          </label>
          <textarea
            className="civis-input w-full rounded-lg resize-none"
            rows={3}
            placeholder="Briefly describe why your organisation needs access to CIVIS AI…"
            value={form.purpose}
            onChange={(e) => set("purpose", e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-700 font-bold text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="civis-btn w-full rounded-full py-3 text-base"
      >
        {loading ? "Registering…" : "Register Organisation →"}
      </button>
    </form>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const router  = useRouter();
  const [agencyId, setAgencyId] = useState("");
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/agency?agency_id=${encodeURIComponent(agencyId.trim().toUpperCase())}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = await res.json();
      if (!data.authorized) { setError(data.message ?? "Unauthorised"); return; }

      // Store credentials in sessionStorage for the dashboard
      sessionStorage.setItem("agency_session", JSON.stringify(data));
      router.push("/agency/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border-4 border-black rounded-2xl p-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div>
        <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
          Agency ID
        </label>
        <input
          className="civis-input w-full rounded-lg font-mono text-lg tracking-widest uppercase"
          placeholder="AGY-XXXXXXXX"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value.toUpperCase())}
          maxLength={12}
          required
        />
        <p className="text-[10px] font-bold text-black/40 mt-1">
          Issued at registration. Format: AGY-XXXXXXXX
        </p>
      </div>

      <div>
        <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
          Official Email Address
        </label>
        <input
          className="civis-input w-full rounded-lg"
          type="email"
          placeholder="official@ministry.gov.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-700 font-bold text-sm">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="civis-btn w-full rounded-full py-3 text-base">
        {loading ? "Verifying…" : "Access Portal →"}
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgencyPortalPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-[90vh] bg-white">
      {/* Hero banner */}
      <div className="bg-black text-white px-6 md:px-16 py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-1">
            <span className="inline-block bg-[#d9ff00] text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Authorised Partners Only
            </span>
            <h1 className="font-black text-5xl md:text-6xl uppercase leading-none tracking-tighter mb-4">
              Agency<br />Portal
            </h1>
            <p className="font-bold text-white/60 text-sm max-w-sm leading-relaxed">
              For government departments, ministries, NGOs and district offices to review
              citizen applications, manage scheme eligibility, and track outcomes.
            </p>
          </div>

          {/* Capabilities block */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            {[
              { icon: "📋", title: "Review Applications", desc: "Full applications queue with citizen details" },
              { icon: "✅", title: "Approve / Reject", desc: "Update status with review notes" },
              { icon: "🔍", title: "Citizen Verification", desc: "View VC-verified citizen identity status" },
              { icon: "📊", title: "Analytics Dashboard", desc: "Real-time stats on schemes and applications" },
            ].map((c) => (
              <div key={c.title} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-2xl mb-1">{c.icon}</div>
                <p className="font-black text-xs uppercase">{c.title}</p>
                <p className="text-[10px] text-white/50 font-bold mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form section */}
      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Tab toggle */}
        <div className="flex border-4 border-black rounded-2xl overflow-hidden mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {([
            { key: "login",    label: "🔑  Sign In" },
            { key: "register", label: "🏛  Register Organisation" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 font-black uppercase text-xs transition-colors ${
                tab === t.key ? "bg-black text-[#d9ff00]" : "bg-white text-black hover:bg-black/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "login" ? <LoginForm /> : <RegisterForm />}

        <p className="text-center text-[10px] font-bold text-black/30 mt-6">
          Need help? Contact{" "}
          <a href="mailto:support@civisai.gov.in" className="underline">
            support@civisai.gov.in
          </a>
        </p>
      </div>
    </div>
  );
}
