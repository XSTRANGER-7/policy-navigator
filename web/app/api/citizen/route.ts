import { NextResponse } from "next/server";
import {
  supabaseServer,
  supabaseConfigured,
  supabaseIsServiceRole,
} from "@/lib/serverSupabase";
import { callCitizenAgent } from "@/lib/n8nClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, age, income, state, category } = body;

    if (!email || !age || !income) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    let citizenRecord = null;

    // Save to Supabase if configured
    if (supabaseConfigured) {
      if (!supabaseIsServiceRole) {
        console.warn(
          "WARN: Using anonymous key for database writes. For production, set SUPABASE_SERVICE_ROLE_KEY or configure proper RLS policies.",
        );
      }

      const { data, error } = await supabaseServer
        .from("citizens")
        .insert([{ email, age, income, state, category }])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error.message);
        // Continue even if DB fails — agent call is still useful
      } else {
        citizenRecord = data;
      }
    }

    // Call the deployed Policy Navigator agent (fire-and-forget)
    await callCitizenAgent({
      citizenId: citizenRecord?.id,
      age: Number(age),
      income: Number(income),
      state: state || "",
      category: category || "",
    });

    return NextResponse.json({
      citizen: citizenRecord,
      agentNotified: true,
    });
  } catch (err: any) {
    console.error("Citizen API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
