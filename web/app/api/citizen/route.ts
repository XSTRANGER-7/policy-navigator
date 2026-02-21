import { NextResponse } from "next/server"
import { supabaseServer, supabaseConfigured, supabaseIsServiceRole } from "@/lib/serverSupabase"
import { callCitizenAgent } from "@/lib/n8nClient"

export async function POST(req: Request) {
  try {
    if (!supabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    if (!supabaseIsServiceRole) {
      // Log warning but allow request to proceed with anon key for development
      console.warn(
        'WARN: Using anonymous key for database writes. For production, set SUPABASE_SERVICE_ROLE_KEY or configure proper RLS policies.'
      )
    }
    const body = await req.json()

    const { email, age, income, state, category } = body

    if (!email || !age || !income) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseServer
      .from("citizens")
      .insert([
        {
          email,
          age,
          income,
          state,
          category
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Call n8n agent
    await callCitizenAgent({
      citizenId: data.id,
      age: data.age,
      income: data.income,
      state: data.state,
      category: data.category
    })

    return NextResponse.json({ citizen: data })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}