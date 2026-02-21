import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

/**
 * GET /api/policies
 * Returns all active schemes from Supabase.
 * Query params:
 *   ?category=farmer    — filter by category
 *   ?q=kisan            — text search in name/description
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    let query = supabaseServer
      .from("schemes")
      .select("id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, is_active")
      .eq("is_active", true)
      .order("name");

    if (category) query = query.eq("category", category);
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ schemes: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
