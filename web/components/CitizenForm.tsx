"use client";

import { useState } from "react";

interface AgentResult {
  status: string;
  response?: string;
  error?: string;
}

export default function CitizenForm() {
  const [form, setForm] = useState({
    email: "",
    age: "",
    income: "",
    state: "",
    category: "",
  });

  const [loading, setLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [savedToDB, setSavedToDB] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAgentResult(null);
    setSavedToDB(false);

    // 1. Save citizen to Supabase (if configured)
    try {
      const citizenRes = await fetch("/api/citizen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          income: Number(form.income),
        }),
      });

      const contentType = citizenRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const citizenData = await citizenRes.json();
        if (!citizenData.error) {
          setSavedToDB(true);
        }
      }
    } catch {
      // Supabase may not be configured — continue with agent call
      console.warn("Could not save to database, proceeding with agent call");
    }

    // 2. Call the deployed Policy Navigator agent (sync)
    try {
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: Number(form.age),
          income: Number(form.income),
          state: form.state,
          category: form.category,
        }),
      });

      const agentData = await agentRes.json();

      if (agentRes.ok) {
        setAgentResult({
          status: "success",
          response: agentData.response,
        });
      } else {
        setAgentResult({
          status: "error",
          error: agentData.error || "Agent returned an error",
        });
      }
    } catch (err: any) {
      setAgentResult({
        status: "error",
        error: err.message || "Failed to reach the agent",
      });
    }

    setLoading(false);
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={handleSubmit} className="civis-card space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
              Email
            </label>
            <input
              className="civis-input w-full rounded-lg"
              placeholder="your@email.com"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
              Age
            </label>
            <input
              className="civis-input w-full rounded-lg"
              placeholder="25"
              type="number"
              required
              min={1}
              max={150}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
              Annual Income (₹)
            </label>
            <input
              className="civis-input w-full rounded-lg"
              placeholder="250000"
              type="number"
              required
              min={0}
              value={form.income}
              onChange={(e) => setForm({ ...form, income: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
              State
            </label>
            <input
              className="civis-input w-full rounded-lg"
              placeholder="Maharashtra"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-black/50 mb-2">
            Category
          </label>
          <select
            className="civis-select w-full rounded-lg"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
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

        <button
          type="submit"
          disabled={loading}
          className="civis-btn w-full rounded-full text-lg py-4"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Checking with Agent...
            </span>
          ) : (
            "Check Eligibility"
          )}
        </button>
      </form>

      {/* Agent Response */}
      {agentResult && (
        <div className="mt-8">
          {agentResult.status === "success" && agentResult.response ? (
            <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#d9ff00] font-black text-lg">
                  ✓
                </div>
                <h3 className="font-black text-xl uppercase tracking-tight">
                  Agent Response
                </h3>
                {savedToDB && (
                  <span className="ml-auto text-[10px] font-black uppercase bg-black text-[#d9ff00] px-3 py-1 rounded-full">
                    Saved to DB
                  </span>
                )}
              </div>
              <div className="bg-white rounded-xl p-5 text-black whitespace-pre-wrap text-sm leading-relaxed border-3 border-black font-medium">
                {agentResult.response}
              </div>
            </div>
          ) : (
            <div className="bg-[#ff5c8d] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#ff5c8d] font-black text-lg">
                  ✗
                </div>
                <h3 className="font-black text-xl uppercase tracking-tight">
                  Could not get results
                </h3>
              </div>
              <p className="font-bold text-sm text-black/80">
                {agentResult.error || "Unknown error occurred"}
              </p>
              <p className="font-bold text-xs text-black/50 mt-2 italic">
                The agent might be warming up (free-tier Render services sleep
                after inactivity). Try again in a moment.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
