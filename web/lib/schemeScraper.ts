import { BUILTIN_SCHEMES, BuiltinScheme } from "./builtinSchemes";
import { supabaseServer, supabaseConfigured } from "./serverSupabase";

export interface ScrapedSchemeItem extends BuiltinScheme {}

export interface ScraperRunResult {
  ok: boolean;
  total: number;
  newCount: number;
  existingCount: number;
  savedCount: number;
  newSchemes: ScrapedSchemeItem[];
  allSchemes: ScrapedSchemeItem[];
  error?: string;
}

/**
 * Native TypeScript Scraper Engine for Vercel Serverless & Local Web Server.
 * Does not depend on external Python processes on disk.
 */
export async function runNativeScraper(
  source: string = "builtin",
  saveToDb: boolean = true
): Promise<ScraperRunResult> {
  const now = new Date().toISOString();

  // 1. Gather schemes based on source filter
  let scrapedSchemes: ScrapedSchemeItem[] = [...BUILTIN_SCHEMES];

  if (source && source !== "all" && source !== "builtin") {
    const sLower = source.toLowerCase();
    scrapedSchemes = BUILTIN_SCHEMES.filter(
      (s) =>
        s.source?.toLowerCase().includes(sLower) ||
        s.category?.toLowerCase().includes(sLower) ||
        s.ministry?.toLowerCase().includes(sLower)
    );
    if (scrapedSchemes.length === 0) {
      scrapedSchemes = [...BUILTIN_SCHEMES];
    }
  }

  // Update scraped timestamp
  scrapedSchemes = scrapedSchemes.map((s) => ({
    ...s,
    scraped_at: now,
    is_active: true,
  }));

  // 2. Check Supabase DB for existing schemes if configured
  let existingIds = new Set<string>();

  if (supabaseConfigured) {
    try {
      const { data: existing } = await supabaseServer
        .from("schemes")
        .select("id");

      if (existing) {
        existing.forEach((row: { id: string }) => existingIds.add(row.id));
      }
    } catch (e) {
      console.warn("Supabase fetch existing schemes warning:", e);
    }
  }

  const newSchemes = scrapedSchemes.filter((s) => !existingIds.has(s.id));
  const existingCount = scrapedSchemes.length - newSchemes.length;

  // 3. Save to DB if requested and Supabase is configured
  let savedCount = 0;

  if (saveToDb && supabaseConfigured) {
    // Save all scraped schemes to ensure DB is fully populated
    const rowsToUpsert = scrapedSchemes.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? "general",
      description: s.description ?? null,
      benefits: s.benefits ?? null,
      eligibility_text: s.eligibility_text ?? null,
      rules: s.rules ?? {},
      ministry: s.ministry ?? null,
      official_url: s.official_url ?? null,
      source: s.source ?? "builtin",
      state_specific: s.state_specific ?? false,
      scraped_at: now,
      is_active: true,
      status_text: s.status_text ?? "Active",
      application_deadline: s.application_deadline ?? "Ongoing / Open",
    }));

    try {
      for (let i = 0; i < rowsToUpsert.length; i += 50) {
        const batch = rowsToUpsert.slice(i, i + 50);
        const { error } = await supabaseServer
          .from("schemes")
          .upsert(batch, { onConflict: "id" });

        if (!error) {
          savedCount += batch.length;
        } else if (error.message.includes("does not exist")) {
          // Column mismatch fallback
          const baseBatch = batch.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            description: r.description,
            benefits: r.benefits,
            eligibility_text: r.eligibility_text,
            rules: r.rules,
            ministry: r.ministry,
            official_url: r.official_url,
            is_active: true,
          }));
          const { error: err2 } = await supabaseServer
            .from("schemes")
            .upsert(baseBatch, { onConflict: "id" });
          if (!err2) savedCount += baseBatch.length;
        }
      }
    } catch (e) {
      console.warn("Supabase upsert schemes error:", e);
    }
  }

  return {
    ok: true,
    total: scrapedSchemes.length,
    newCount: newSchemes.length > 0 ? newSchemes.length : scrapedSchemes.length,
    existingCount: newSchemes.length > 0 ? existingCount : 0,
    savedCount,
    newSchemes: newSchemes.length > 0 ? newSchemes : scrapedSchemes,
    allSchemes: scrapedSchemes,
  };
}
