import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/serverSupabase";

/** POST /api/scrape/add — upsert one scraped scheme into the DB */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.id || !body.name) {
      return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    const row = {
      id:               String(body.id).slice(0, 80),
      name:             String(body.name).slice(0, 200),
      category:         body.category ?? "general",
      description:      body.description ?? null,
      benefits:         body.benefits ?? null,
      eligibility_text: body.eligibility_text ?? null,
      rules:            body.rules ?? {},
      ministry:         body.ministry ?? null,
      official_url:     body.official_url ?? null,
      source:           body.source ?? "scraped",
      state_specific:   body.state_specific ?? false,
      scraped_at:       new Date().toISOString(),
      is_active:        true,
    };

    const { error } = await supabaseServer
      .from("schemes")
      .upsert(row, { onConflict: "id" });

    if (error) {
      // New columns might not exist yet — retry without them
      if (error.message.includes("does not exist")) {
        const { id, name, category, description, benefits, eligibility_text, rules, ministry, official_url } = row;
        const { error: err2 } = await supabaseServer
          .from("schemes")
          .upsert({ id, name, category, description, benefits, eligibility_text, rules, ministry, official_url, is_active: true }, { onConflict: "id" });
        if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
        return NextResponse.json({ ok: true, id: row.id, note: "saved without new schema columns" });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
