import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

/**
 * GET /api/applications
 *
 * Citizen: ?email=x  or  ?citizenId=uuid
 *   → returns all applications linked to that citizen
 *
 * Agency:  ?role=agency
 *   → returns ALL applications with citizen details (for agency review panel)
 *
 * PATCH /api/applications
 *   Agency updates status: { application_id, status, notes? }
 */
export async function GET(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ applications: [], total: 0, note: "Supabase not configured" });
  }

  const { searchParams } = new URL(req.url);
  const email     = searchParams.get("email")?.trim().toLowerCase();
  const citizenId = searchParams.get("citizenId");
  const role      = searchParams.get("role") ?? "citizen";

  try {
    // ── Agency: all applications ─────────────────────────────────────────
    if (role === "agency") {
      const { data, error } = await supabaseServer
        .from("applications")
        .select(`
          id, scheme_id, scheme_name, status, docs, notes,
          submitted_at, reviewed_at, updated_at, citizen_id,
          citizens ( email, age, state, category, verified )
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ applications: data ?? [], total: data?.length ?? 0 });
    }

    // ── Citizen: own applications ─────────────────────────────────────────
    let cid = citizenId;

    if (!cid && email) {
      const { data: citizen } = await supabaseServer
        .from("citizens")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!citizen) {
        return NextResponse.json({ applications: [], total: 0, message: "No citizen record found." });
      }
      cid = citizen.id;
    }

    if (!cid) {
      return NextResponse.json({ error: "email or citizenId required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("applications")
      .select("id, scheme_id, scheme_name, status, docs, notes, submitted_at, reviewed_at, updated_at")
      .eq("citizen_id", cid)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ applications: data ?? [], total: data?.length ?? 0, citizen_id: cid });

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * PATCH /api/applications
 * Agency updates an application's status.
 * body: { application_id: string, status: string, notes?: string }
 */
export async function PATCH(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  try {
    const { application_id, status, notes } = await req.json();
    if (!application_id || !status) {
      return NextResponse.json({ error: "application_id and status required" }, { status: 400 });
    }

    const VALID = ["started", "documents_submitted", "under_review", "approved", "rejected"];
    if (!VALID.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be: ${VALID.join(", ")}` }, { status: 400 });
    }

    const update: Record<string, unknown> = { status };
    if (notes !== undefined) update.notes = notes;
    if (status === "approved" || status === "rejected") {
      update.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await supabaseServer
      .from("applications")
      .update(update)
      .eq("id", application_id)
      .select("id, scheme_name, status, reviewed_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, application: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
