import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/serverSupabase"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    let citizenId = searchParams.get("citizenId")
    const email   = searchParams.get("email")

    if (!citizenId && !email) {
      return NextResponse.json({ error: "citizenId or email is required" }, { status: 400 })
    }

    // Resolve citizenId from email if needed
    if (!citizenId && email) {
      const { data: citizen } = await supabaseServer
        .from("citizens")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (!citizen) return NextResponse.json({ error: "No citizen record found for that email" }, { status: 404 })
      citizenId = citizen.id
    }

    const { data, error } = await supabaseServer
      .from("credentials")
      .select("vc_json")
      .eq("citizen_id", citizenId)
      .single()

    if (error) return NextResponse.json({ error: "No VC found — run the eligibility check first" }, { status: 404 })

    return NextResponse.json({ vc: data.vc_json })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}