import { NextResponse } from "next/server";
import { runNativeScraper } from "@/lib/schemeScraper";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const source: string = body.source ?? "builtin";
    const saveToDb: boolean = body.saveToDb ?? true;

    // Run the native TypeScript scraper engine (works in Vercel Serverless & Local)
    const result = await runNativeScraper(source, saveToDb);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const e = err as Error;
    console.error("❌ /api/scrape error:", e);

    // Fall back to native scraper even on error
    try {
      const fallbackResult = await runNativeScraper("builtin", true);
      return NextResponse.json(fallbackResult);
    } catch {
      return NextResponse.json(
        { error: e.message ?? "Scraper failed" },
        { status: 500 }
      );
    }
  }
}
