import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";
import { BUILTIN_SCHEMES } from "@/lib/builtinSchemes";

/**
 * GET /api/policies
 * Returns active schemes from Supabase, or built-in fallback dataset.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  if (supabaseConfigured) {
    try {
      let query = supabaseServer
        .from("schemes")
        .select("id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, is_active")
        .order("name");

      if (category) query = query.eq("category", category);
      if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return NextResponse.json({ schemes: data });
      }
    } catch (err) {
      console.warn("⚠️ Supabase policies query failed, using fallback:", err);
    }
  }

  // Fallback to builtin schemes dataset
  let filtered = [...BUILTIN_SCHEMES];
  if (category) {
    filtered = filtered.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }
  if (q) {
    const qLower = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(qLower) ||
        (s.description && s.description.toLowerCase().includes(qLower)) ||
        (s.benefits && s.benefits.toLowerCase().includes(qLower))
    );
  }

  return NextResponse.json({ schemes: filtered, fallback: true });
}
