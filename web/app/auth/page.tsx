"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [tab, setTab]               = useState<"signin" | "signup">("signin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [fullName, setFullName]     = useState("");
  const [role, setRole]             = useState<"citizen" | "agency">("citizen");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (tab === "signin") {
      const r = await signIn(email, password);
      if (r.error) setError(r.error);
      else router.push("/eligibility");
    } else {
      const r = await signUp(email, password, role, fullName);
      if (r.error) setError(r.error);
      else setSuccess("Account created! Check your email to confirm, then sign in.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-black text-4xl uppercase tracking-tighter">
            {tab === "signin" ? "Welcome Back" : "Join CIVIS AI"}
          </h1>
          <p className="font-bold text-black/50 mt-2 text-sm">
            {tab === "signin"
              ? "Sign in to track your applications"
              : "Create an account to apply for government schemes"}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex border-4 border-black rounded-2xl overflow-hidden mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              className={`flex-1 py-3 font-black uppercase text-sm transition-colors ${
                tab === t ? "bg-black text-[#d9ff00]" : "bg-white text-black hover:bg-black/5"
              }`}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border-4 border-black rounded-2xl p-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
          {tab === "signup" && (
            <>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                  Full Name
                </label>
                <input
                  className="civis-input w-full rounded-lg"
                  placeholder="Ravi Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
                  I am a…
                </label>
                <div className="flex gap-3">
                  {(["citizen", "agency"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-3 rounded-xl border-3 border-black font-black uppercase text-xs transition-all ${
                        role === r
                          ? "bg-[#d9ff00] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white hover:bg-black/5"
                      }`}
                    >
                      {r === "citizen" ? "👤 Citizen" : "🏛 Agency / NGO"}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-bold text-black/40 mt-1">
                  {role === "agency"
                    ? "Agencies can manage and review applications"
                    : "Citizens can check eligibility and apply for schemes"}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
              Email Address
            </label>
            <input
              className="civis-input w-full rounded-lg"
              type="email"
              placeholder="ravi@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-1.5">
              Password
            </label>
            <input
              className="civis-input w-full rounded-lg"
              type="password"
              placeholder="Minimum 6 characters"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-700 font-bold text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-[#d9ff00] border-2 border-black rounded-xl p-3 text-black font-bold text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="civis-btn w-full rounded-full py-3 text-base"
          >
            {loading
              ? "Please wait…"
              : tab === "signin"
              ? "Sign In →"
              : "Create Account →"}
          </button>
        </form>

        {/* Notice for unconfigured Supabase */}
        <p className="text-center text-[10px] font-bold text-black/30 mt-4">
          Auth requires Supabase env vars.{" "}
          <span className="underline cursor-pointer" onClick={() => router.push("/eligibility")}>
            Skip to eligibility check →
          </span>
        </p>
      </div>
    </div>
  );
}
