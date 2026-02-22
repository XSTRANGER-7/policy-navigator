import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { supabaseServer } from "@/lib/serverSupabase";

const execFileAsync = promisify(execFile);

// Paths relative to the Next.js project root (web/)
const ROOT        = path.resolve(process.cwd(), "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "scrape_schemes.py");

/** Try several Python executables in order. */
function getPythonExe(): string {
  const candidates = [
    path.join(ROOT, ".venv", "Scripts", "python.exe"),   // Windows venv
    path.join(ROOT, ".venv", "bin", "python"),            // Linux/macOS venv
    "python",
    "python3",
  ];
  // Return first that exists on disk; fall back to "python"
  const fs = require("fs") as typeof import("fs");
  for (const c of candidates) {
    try {
      if (c.includes(path.sep) && fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return "python";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const source: string  = body.source ?? "builtin"; // builtin | all | myscheme | pmindia
    const saveToDb: boolean = body.saveToDb ?? false;

    const python = getPythonExe();
    const args   = [SCRIPT_PATH, "--json-output", "--source", source];

    // Run the scraper — allow up to 90 s for network sources
    const timeout = source === "builtin" ? 15_000 : 90_000;

    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(python, args, { timeout, encoding: "utf8" });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      stdout = e.stdout ?? "";
      stderr = e.stderr ?? "";
      if (!stdout.trim()) {
        return NextResponse.json(
          { error: "Scraper process failed", detail: e.message, stderr: stderr.slice(0, 800) },
          { status: 500 },
        );
      }
    }

    // Parse the JSON line from stdout
    let scraped: Record<string, unknown>[] = [];
    for (const line of stdout.split("\n").reverse()) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          scraped = parsed.schemes ?? parsed ?? [];
          break;
        } catch {
          continue;
        }
      }
    }

    if (scraped.length === 0) {
      return NextResponse.json(
        { error: "No schemes returned by scraper", stderr: stderr.slice(0, 400) },
        { status: 500 },
      );
    }

    // Get existing scheme IDs from Supabase to know which are new
    const { data: existing } = await supabaseServer
      .from("schemes")
      .select("id, name")
      .eq("is_active", true);

    const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));

    const newSchemes    = scraped.filter((s) => !existingIds.has(s.id as string));
    const existingCount = scraped.length - newSchemes.length;

    // Optionally save all scraped schemes right now
    let savedCount = 0;
    if (saveToDb && newSchemes.length > 0) {
      const rows = newSchemes.map((s) => ({
        id:               s.id,
        name:             s.name,
        category:         s.category ?? "general",
        description:      s.description ?? null,
        benefits:         s.benefits ?? null,
        eligibility_text: s.eligibility_text ?? null,
        rules:            s.rules ?? {},
        ministry:         s.ministry ?? null,
        official_url:     s.official_url ?? null,
        source:           s.source ?? "scraped",
        state_specific:   s.state_specific ?? false,
        scraped_at:       new Date().toISOString(),
        is_active:        true,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabaseServer.from("schemes").upsert(batch, { onConflict: "id" });
        if (!error) savedCount += batch.length;
      }
    }

    return NextResponse.json({
      ok:            true,
      total:         scraped.length,
      newCount:      newSchemes.length,
      existingCount,
      savedCount,
      newSchemes,
      allSchemes:    scraped,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
