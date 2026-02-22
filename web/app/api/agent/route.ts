import { NextResponse } from "next/server";
import { callCitizenAgentSync, checkAgentHealth } from "@/lib/n8nClient";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

/**
 * POST /api/agent
 * 1. Saves citizen profile to `citizens` table (if Supabase configured).
 * 2. Runs full AI eligibility pipeline via the orchestrator agent.
 * 3. Saves the issued VC + eligibility result to `credentials` table.
 * 4. Returns everything to the frontend.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { age, income, state, category, email } = body;

    if (!age || !income) {
      return NextResponse.json(
        { error: "Age and income are required" },
        { status: 400 },
      );
    }

    // ── 1. Persist citizen profile ────────────────────────────────────────
    let citizenId: string | null = null;
    let savedToDB = false;

    if (supabaseConfigured && email) {
      try {
        const { data: citizen, error } = await supabaseServer
          .from("citizens")
          .insert([{
            email:    email.trim().toLowerCase(),
            age:      Number(age),
            income:   Number(income),
            state:    state || null,
            category: category || null,
          }])
          .select("id")
          .single();

        if (!error && citizen) {
          citizenId = citizen.id;
          savedToDB = true;
        } else {
          console.warn("Citizens insert warning:", error?.message);
        }
      } catch (e) {
        console.warn("Supabase citizen save skipped:", e);
      }
    }

    // ── 2. Run agent pipeline ─────────────────────────────────────────────
    const result = await callCitizenAgentSync({
      age:      Number(age),
      income:   Number(income),
      state:    state   || "Unknown",
      category: category || "general",
      email:    email   || "",
    });

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error || "Agent returned an error" },
        { status: 502 },
      );
    }
    if (result.status === "timeout") {
      return NextResponse.json(
        { error: "Agent did not respond in time. Please try again." },
        { status: 504 },
      );
    }

    const pipelineData = result.response;
    const pipelineObj  = pipelineData as unknown as Record<string, unknown>;

    // ── 3. Persist VC + eligibility to `credentials` table ────────────────
    if (supabaseConfigured && pipelineData && typeof pipelineData === "object") {
      const vc             = pipelineObj.vc;
      const rankedSchemes  = pipelineObj.ranked_schemes ?? [];
      const totalEligible  = pipelineObj.total_eligible ?? 0;
      const vcObj          = vc as Record<string, unknown> | null | undefined;
      const citizenDid     = vcObj?.credentialSubject
        ? ((vcObj.credentialSubject as Record<string, unknown>)?.id as string)
        : null;
      const expiresAt      = vcObj?.expirationDate as string ?? null;

      if (vc) {
        try {
          // Upsert: replace previous record for same citizen (latest wins)
          const credRow: Record<string, unknown> = {
            vc_json:        vc,
            schemes:        rankedSchemes,
            total_eligible: totalEligible,
            citizen_did:    citizenDid,
            expires_at:     expiresAt,
          };
          if (citizenId) credRow.citizen_id = citizenId;

          await supabaseServer
            .from("credentials")
            .insert([credRow]);

          // Mark citizen as verified
          if (citizenId) {
            await supabaseServer
              .from("citizens")
              .update({ verified: true, verified_at: new Date().toISOString() })
              .eq("id", citizenId);
          }
        } catch (e) {
          console.warn("Supabase credentials save skipped:", e);
        }
      }
    }

    // ── 4. Return to frontend ─────────────────────────────────────────────
    return NextResponse.json({
      status:    "success",
      citizen_id: citizenId,
      saved_to_db: savedToDB,
      response:  pipelineData,
    });

  } catch (err: unknown) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agent — health check
 */
export async function GET() {
  try {
    const health = await checkAgentHealth();
    return NextResponse.json(health);
  } catch (err: unknown) {
    return NextResponse.json(
      { status: "unreachable", error: (err as Error).message },
      { status: 503 },
    );
  }
}
