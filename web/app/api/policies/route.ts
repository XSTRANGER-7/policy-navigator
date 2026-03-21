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
    return NextResponse.json(
      { error: "Supabase not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local" },
      { status: 503 }
    );
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
    if (error) {
      console.error("❌ Supabase query error:", error.message);
      // Check if table doesn't exist
      if (error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            error: "Database schema not initialized",
            hint: "Run: supabase/schema.sql in Supabase Dashboard, then: python scripts/scrape_schemes.py --source builtin",
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ schemes: data ?? [] });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ /api/policies error:", errorMsg);
    return NextResponse.json(
      {
        error: errorMsg,
        hint: "Make sure Supabase env vars are set and schema.sql has been deployed",
      },
      { status: 500 }
    );
  }
}
