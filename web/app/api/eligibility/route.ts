import { NextResponse } from "next/server"
import { supabaseServer, supabaseIsServiceRole } from "@/lib/serverSupabase"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const citizenId = searchParams.get("citizenId")

    if (!citizenId) {
      return NextResponse.json(
        { error: "citizenId is required" },
        { status: 400 }
      )
    }

    if (!supabaseIsServiceRole) {
      console.warn('WARN: Using anonymous key for data access. For production, set SUPABASE_SERVICE_ROLE_KEY.')
    }

    const { data, error } = await supabaseServer
      .from("credentials")
      .select("*")
      .eq("citizen_id", citizenId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ credential: data })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}