import { NextResponse } from "next/server";
import {
  supabaseServer,
  supabaseConfigured,
} from "@/lib/serverSupabase";

/**
 * GET /api/applications?email=<email>&limit=<n>
 * Lists applications for a given email (or all if service role).
 * Used by the dashboard and eligibility page.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email  = searchParams.get("email");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  if (!supabaseConfigured) {
    return NextResponse.json({ applications: [], total: 0, note: "Supabase not configured" });
  }

  try {
    let query = supabaseServer
      .from("applications")
      .select("id, scheme_id, scheme_name, status, docs, submitted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    // If email provided, join through citizens table
    if (email) {
      // First look up citizen_id by email
      const { data: citizen } = await supabaseServer
        .from("citizens")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (citizen?.id) {
        query = query.eq("citizen_id", citizen.id);
      } else {
        return NextResponse.json({ applications: [], total: 0 });
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Applications fetch error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: data ?? [], total: count ?? (data?.length ?? 0) });
  } catch (err: any) {
    console.error("Applications API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
