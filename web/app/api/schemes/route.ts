import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";

/**
 * GET /api/schemes
 * Returns scraped + seeded government schemes from Supabase.
 *
 * Query params:
 *   ?category=farmer          — filter by category
 *   ?ministry=Education       — filter by ministry (partial match)
 *   ?source=myscheme.gov.in   — filter by scraper source
 *   ?state_specific=true      — only state-specific schemes
 *   ?q=kisan                  — text search
 *   ?limit=50                 — max results (default 100)
 *   ?page=1                   — pagination (default 1)
 *   ?sort=name|scraped_at|created_at  — sort field (default name)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const category     = searchParams.get("category");
  const ministry     = searchParams.get("ministry");
  const source       = searchParams.get("source");
  const stateSpec    = searchParams.get("state_specific");
  const q            = searchParams.get("q");
  const limit        = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200);
  const page         = Math.max(parseInt(searchParams.get("page") ?? "1"), 1);
  const sort         = searchParams.get("sort") ?? "name";
  const from         = (page - 1) * limit;

  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured", schemes: [], total: 0 }, { status: 503 });
  }

  try {
    // Detect which columns exist by trying the full query first, then falling
    // back to the base columns if new ones (source / state_specific / scraped_at)
    // have not been migrated yet.
    const FULL_COLS =
      "id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, source, state_specific, scraped_at, is_active, created_at";
    const BASE_COLS =
      "id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, is_active, created_at";

    async function buildQuery(cols: string) {
      let qb = supabaseServer
        .from("schemes")
        .select(cols, { count: "exact" })
        .eq("is_active", true);

      if (category)             qb = qb.eq("category", category);
      // Only apply new-column filters when those columns exist
      if (cols.includes("state_specific")) {
        if (stateSpec === "true")  qb = qb.eq("state_specific", true);
        if (stateSpec === "false") qb = qb.eq("state_specific", false);
      }
      if (cols.includes("source") && source) qb = qb.eq("source", source);
      if (ministry)             qb = qb.ilike("ministry", `%${ministry}%`);
      if (q)                    qb = qb.or(`name.ilike.%${q}%,description.ilike.%${q}%,benefits.ilike.%${q}%,ministry.ilike.%${q}%`);

      const validSorts = ["name", "scraped_at", "created_at"];
      const sortField = validSorts.includes(sort) ? sort : "name";
      const actualSort = sortField === "scraped_at" && !cols.includes("scraped_at") ? "created_at" : sortField;
      qb = qb.order(actualSort, { ascending: actualSort === "name" });
      qb = qb.range(from, from + limit - 1);
      return qb;
    }

    let result = await (await buildQuery(FULL_COLS));

    // If new columns missing, retry with base columns only
    if (result.error?.message?.includes("column") && result.error.message.includes("does not exist")) {
      result = await (await buildQuery(BASE_COLS));
    }

    const { data, error, count } = result;
    if (error) throw error;

    // Aggregate metadata for filters panel (resilient to missing columns)
    let sources: string[]    = [];
    let ministries: string[] = [];
    let categories: string[] = [];

    const metaFull = await supabaseServer
      .from("schemes")
      .select("category, source, ministry")
      .eq("is_active", true);

    if (metaFull.error?.message?.includes("does not exist")) {
      // source column missing — fetch without it
      const metaBase = await supabaseServer
        .from("schemes")
        .select("category, ministry")
        .eq("is_active", true);
      const rows = metaBase.data ?? [];
      ministries = [...new Set(rows.map((r) => r.ministry).filter(Boolean))].sort();
      categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
    } else {
      const rows = metaFull.data ?? [];
      sources    = [...new Set(rows.map((r) => r.source).filter(Boolean))].sort();
      ministries = [...new Set(rows.map((r) => r.ministry).filter(Boolean))].sort();
      categories = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
    }

    return NextResponse.json({
      schemes:    data ?? [],
      total:      count ?? 0,
      page,
      limit,
      sources,
      ministries,
      categories,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message, schemes: [], total: 0 }, { status: 500 });
  }
}
