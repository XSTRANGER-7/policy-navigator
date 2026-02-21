import { NextResponse } from "next/server";
import {
  supabaseServer,
  supabaseConfigured,
} from "@/lib/serverSupabase";

const APPLY_AGENT_URL =
  process.env.APPLY_AGENT_URL ?? "http://127.0.0.1:5005";

async function callApplyAgent(payload: object, timeout = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${APPLY_AGENT_URL}/webhook/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: JSON.stringify(payload),
        sender_id: "policy-navigator-web",
        message_type: "query",
        metadata: payload,
      }),
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`Agent HTTP ${res.status}`);
    const data = await res.json();
    let response = data.response;
    if (typeof response === "string") {
      try { response = JSON.parse(response); } catch { /* leave as string */ }
    }
    return { ok: true, data: response };
  } catch (e: any) {
    clearTimeout(id);
    return { ok: false, error: e.message };
  }
}

/**
 * POST /api/apply
 * Two modes:
 *   action="get_docs"  → returns required docs list for a scheme
 *   action="submit"    → creates application, saves to Supabase
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = "get_docs", scheme_id, scheme_name, category } = body;

    /* ── Get docs (no DB write) ───────────────────────────────── */
    if (action === "get_docs") {
      const result = await callApplyAgent({ action: "get_docs", scheme_id, category });
      if (!result.ok) {
        // Fallback: return generic list
        return NextResponse.json({
          scheme_id,
          required_docs: ["Aadhaar Card", "Income Certificate", "Bank Account"],
        });
      }
      return NextResponse.json(result.data);
    }

    /* ── Submit application ───────────────────────────────────── */
    if (action === "submit") {
      if (!scheme_id || !scheme_name) {
        return NextResponse.json(
          { error: "scheme_id and scheme_name are required" },
          { status: 400 },
        );
      }

      // 1. Call agent for validation + next_steps
      const agentResult = await callApplyAgent(body);
      const agentData = agentResult.ok ? agentResult.data : null;

      // 2. Save to Supabase (best-effort)
      let savedId: string | null = null;
      if (supabaseConfigured) {
        try {
          const { data: saved, error } = await supabaseServer
            .from("applications")
            .insert([
              {
                scheme_id,
                scheme_name,
                status: "started",
                docs: JSON.stringify(body.docs ?? {}),
                citizen_id: body.citizen_id ?? null,
                submitted_at: new Date().toISOString(),
              },
            ])
            .select("id")
            .single();
          if (!error && saved) savedId = saved.id;
        } catch {
          // DB unavailable — continue
        }
      }

      const appId = savedId ?? agentData?.application_id ?? `APP-${Date.now().toString(36).toUpperCase()}`;

      return NextResponse.json({
        application_id: appId,
        scheme_id,
        scheme_name,
        status: "started",
        required_docs: agentData?.required_docs ?? [],
        next_steps: agentData?.next_steps ?? [
          "Gather all required documents",
          "Visit your nearest CSC or apply on the official portal",
          `Track progress with Application ID: ${appId}`,
        ],
        steps: agentData?.steps ?? [],
        message:    `Application for ${scheme_name} submitted successfully.`,
        saved_to_db: savedId !== null,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Apply API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/apply?scheme_id=<id>
 * Returns required docs for a given scheme (no agent call needed client-side)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scheme_id = searchParams.get("scheme_id") ?? "";
  const category  = searchParams.get("category") ?? "general";

  const result = await callApplyAgent({ action: "get_docs", scheme_id, category });
  if (!result.ok) {
    return NextResponse.json({
      scheme_id,
      required_docs: ["Aadhaar Card", "Income Certificate", "Bank Account"],
    });
  }
  return NextResponse.json(result.data);
}
