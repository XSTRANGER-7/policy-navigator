import { NextResponse } from "next/server";
import { supabaseServer, supabaseConfigured } from "@/lib/serverSupabase";
import { BUILTIN_SCHEMES, BuiltinScheme } from "@/lib/builtinSchemes";

/** In-memory filtering helper for builtin fallback dataset */
function filterBuiltinSchemes(params: {
  category: string | null;
  ministry: string | null;
  source: string | null;
  stateSpec: string | null;
  q: string | null;
  page: number;
  limit: number;
}) {
  const { category, ministry, source, stateSpec, q, page, limit } = params;

  let filtered: BuiltinScheme[] = [...BUILTIN_SCHEMES];

  if (category) {
    filtered = filtered.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }

  if (source) {
    filtered = filtered.filter(
      (s) => s.source && s.source.toLowerCase().includes(source.toLowerCase())
    );
  }

  if (ministry) {
    filtered = filtered.filter(
      (s) => s.ministry && s.ministry.toLowerCase().includes(ministry.toLowerCase())
    );
  }

  if (stateSpec === "true") {
    filtered = filtered.filter((s) => s.state_specific === true);
  } else if (stateSpec === "false") {
    filtered = filtered.filter((s) => s.state_specific === false);
  }

  if (q) {
    const qLower = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(qLower) ||
        (s.description && s.description.toLowerCase().includes(qLower)) ||
        (s.benefits && s.benefits.toLowerCase().includes(qLower)) ||
        (s.ministry && s.ministry.toLowerCase().includes(qLower))
    );
  }

  const total = filtered.length;
  const from = (page - 1) * limit;
  const pagedSchemes = filtered.slice(from, from + limit);

  const sources = [...new Set(BUILTIN_SCHEMES.map((s) => s.source).filter(Boolean))] as string[];
  const ministries = [...new Set(BUILTIN_SCHEMES.map((s) => s.ministry).filter(Boolean))] as string[];
  const categories = [...new Set(BUILTIN_SCHEMES.map((s) => s.category).filter(Boolean))] as string[];

  return {
    schemes: pagedSchemes,
    total,
    page,
    limit,
    sources,
    ministries,
    categories,
    fallback: true,
  };
}

/**
 * GET /api/schemes
 * Returns scraped + seeded government schemes from Supabase, or built-in fallback.
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

  if (supabaseConfigured) {
    try {
      const FULL_COLS =
        "id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, source, state_specific, scraped_at, is_active, created_at";
      const BASE_COLS =
        "id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, is_active, created_at";

      async function buildQuery(cols: string) {
        let qb = supabaseServer
          .from("schemes")
          .select(cols, { count: "exact" });

        if (category)             qb = qb.eq("category", category);
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

      if (result.error?.message?.includes("column") && result.error.message.includes("does not exist")) {
        result = await (await buildQuery(BASE_COLS));
      }

      const { data, error, count } = result;

      if (!error && data && data.length > 0) {
        let sources: string[]    = [];
        let ministries: string[] = [];
        let categories: string[] = [];

        const metaFull = await supabaseServer
          .from("schemes")
          .select("category, source, ministry");

        if (metaFull.error?.message?.includes("does not exist")) {
          const metaBase = await supabaseServer
            .from("schemes")
            .select("category, ministry");
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
          schemes:    data,
          total:      count ?? data.length,
          page,
          limit,
          sources,
          ministries,
          categories,
        });
      }
    } catch (err) {
      console.warn("⚠️ Supabase schemes query failed, using builtin fallback:", err);
    }
  }

  // Fallback to built-in scheme dataset if Supabase has 0 rows or is unconfigured
  const fallbackResult = filterBuiltinSchemes({
    category,
    ministry,
    source,
    stateSpec,
    q,
    page,
    limit,
  });

  return NextResponse.json(fallbackResult);
}
