import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

// Generates a readable Agency ID like AGY-A1B2C3D4
function generateAgencyId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `AGY-${code}`;
}

// ─── POST /api/agency ── Register a new agency ────────────────────────────
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Database not configured. Set Supabase env vars." }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { org_name, org_type, state, reg_number, contact_person, email, purpose } = body;

    if (!org_name || !org_type || !state || !contact_person || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if email already registered
    const { data: existing, error: lookupErr } = await supabaseServer
      .from("agencies")
      .select("agency_id, status")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (lookupErr && lookupErr.code !== "PGRST116") {
      // PGRST116 = row not found (ok); anything else is a real DB error
      const hint = lookupErr.message?.includes("does not exist")
        ? " — Run supabase/schema.sql in your Supabase SQL Editor first."
        : "";
      throw new Error(lookupErr.message + hint);
    }

    if (existing) {
      return NextResponse.json(
        { error: "An agency with this email is already registered.", existing_id: existing.agency_id },
        { status: 409 }
      );
    }

    // Generate unique agency_id (retry until unique)
    let agency_id = generateAgencyId();
    let attempts = 0;
    while (attempts < 5) {
      const { data: clash } = await supabaseServer
        .from("agencies")
        .select("id")
        .eq("agency_id", agency_id)
        .maybeSingle();
      if (!clash) break;
      agency_id = generateAgencyId();
      attempts++;
    }

    const { data, error } = await supabaseServer
      .from("agencies")
      .insert({
        agency_id,
        org_name:       org_name.trim(),
        org_type,
        state,
        reg_number:     reg_number?.trim() || null,
        contact_person: contact_person.trim(),
        email:          email.toLowerCase().trim(),
        purpose:        purpose?.trim() || null,
        status:         "active",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      agency_id:      data.agency_id,
      org_name:       data.org_name,
      email:          data.email,
      contact_person: data.contact_person,
      status:         data.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET /api/agency?agency_id=AGY-XXX&email=org@gov.in ── Login / verify ──
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const agency_id = searchParams.get("agency_id")?.trim().toUpperCase();
  const email     = searchParams.get("email")?.trim().toLowerCase();

  if (!agency_id || !email) {
    return NextResponse.json({ error: "agency_id and email are required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseServer
      .from("agencies")
      .select("*")
      .eq("agency_id", agency_id)
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { authorized: false, message: "Invalid Agency ID or email. Please check your credentials." },
        { status: 401 }
      );
    }

    if (data.status !== "active") {
      return NextResponse.json(
        { authorized: false, message: `Your agency account is currently ${data.status}. Contact support.` },
        { status: 403 }
      );
    }

    // Fetch application stats for this agency
    const { count: total }    = await supabaseServer.from("applications").select("*", { count: "exact", head: true });
    const { count: pending }  = await supabaseServer.from("applications").select("*", { count: "exact", head: true }).eq("status", "under_review");
    const { count: approved } = await supabaseServer.from("applications").select("*", { count: "exact", head: true }).eq("status", "approved");
    const { count: rejected } = await supabaseServer.from("applications").select("*", { count: "exact", head: true }).eq("status", "rejected");

    return NextResponse.json({
      authorized:     true,
      agency_id:      data.agency_id,
      org_name:       data.org_name,
      org_type:       data.org_type,
      state:          data.state,
      contact_person: data.contact_person,
      email:          data.email,
      status:         data.status,
      created_at:     data.created_at,
      stats: {
        total:    total    ?? 0,
        pending:  pending  ?? 0,
        approved: approved ?? 0,
        rejected: rejected ?? 0,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
