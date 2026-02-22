import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

/**
 * GET /api/verify?email=x  OR  ?citizenId=uuid
 *
 * Returns the citizen's verification status + VC summary.
 * "Verified" = they have a VC in the credentials table (pipeline ran successfully).
 *
 * Also supports agency lookup:
 * GET /api/verify?email=x&role=agency
 *   → checks user_profiles for role='agency' via Supabase auth admin
 */
export async function GET(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const email     = searchParams.get("email")?.trim().toLowerCase();
  const citizenId = searchParams.get("citizenId");
  const role      = searchParams.get("role") ?? "citizen"; // "citizen" | "agency"

  if (!email && !citizenId) {
    return NextResponse.json({ error: "email or citizenId required" }, { status: 400 });
  }

  // ── Agency verification ──────────────────────────────────────────────────
  if (role === "agency") {
    if (!email) {
      return NextResponse.json({ error: "email required for agency lookup" }, { status: 400 });
    }
    try {
      // Look up auth user by email (service role only)
      const { data: { users }, error } = await supabaseServer.auth.admin.listUsers();
      if (error) throw error;

      const authUser = users.find((u) => u.email?.toLowerCase() === email);
      if (!authUser) {
        return NextResponse.json({
          verified: false,
          role: "agency",
          message: "No account found for that email. Register at /auth with role = Agency.",
        });
      }

      // Check their profile role
      const { data: profile } = await supabaseServer
        .from("user_profiles")
        .select("role, full_name, organisation")
        .eq("id", authUser.id)
        .single();

      if (!profile || profile.role !== "agency") {
        return NextResponse.json({
          verified: false,
          role: "agency",
          message: "Account exists but is not registered as an Agency. Sign up at /auth and select Agency role.",
        });
      }

      return NextResponse.json({
        verified: true,
        role: "agency",
        email,
        full_name:    profile.full_name,
        organisation: profile.organisation,
        auth_id:      authUser.id,
        message:      "Agency identity verified.",
      });
    } catch (err: unknown) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ── Citizen verification ──────────────────────────────────────────────────
  try {
    let cid = citizenId;

    // Resolve citizenId from email (newest record)
    if (!cid && email) {
      const { data: citizen } = await supabaseServer
        .from("citizens")
        .select("id, verified, verified_at, email, age, state, category")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!citizen) {
        return NextResponse.json({
          verified: false,
          message: "No citizen record found. Submit the eligibility form first.",
        });
      }
      cid = citizen.id;
    }

    // Fetch citizen row
    const { data: citizen } = await supabaseServer
      .from("citizens")
      .select("id, email, age, state, category, verified, verified_at, created_at")
      .eq("id", cid)
      .single();

    if (!citizen) {
      return NextResponse.json({
        verified: false,
        message: "No citizen record found. Submit the eligibility form first.",
      });
    }

    // Fetch their VC
    const { data: credential } = await supabaseServer
      .from("credentials")
      .select("citizen_did, total_eligible, schemes, issued_at, expires_at, vc_json")
      .eq("citizen_id", citizen.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      verified:    citizen.verified || !!credential,
      role:        "citizen",
      citizen_id:  citizen.id,
      email:       citizen.email,
      profile: {
        age:      citizen.age,
        state:    citizen.state,
        category: citizen.category,
      },
      verified_at:    citizen.verified_at,
      created_at:     citizen.created_at,
      // VC summary
      has_vc:         !!credential,
      citizen_did:    credential?.citizen_did ?? null,
      total_eligible: credential?.total_eligible ?? 0,
      schemes:        credential?.schemes ?? [],
      vc_issued_at:   credential?.issued_at ?? null,
      vc_expires_at:  credential?.expires_at ?? null,
      vc_json:        credential?.vc_json ?? null,
      message: credential
        ? "Citizen identity verified via Verifiable Credential."
        : "Citizen record exists but no VC — run the eligibility pipeline first.",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
