import { NextResponse } from "next/server";
import { callCitizenAgentSync, checkAgentHealth } from "@/lib/n8nClient";

/**
 * POST /api/agent
 * Sends citizen data to the deployed Policy Navigator agent (sync)
 * and returns the agent's eligibility response.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { age, income, state, category } = body;

    if (!age || !income) {
      return NextResponse.json(
        { error: "Age and income are required" },
        { status: 400 },
      );
    }

    const result = await callCitizenAgentSync({
      age: Number(age),
      income: Number(income),
      state: state || "Unknown",
      category: category || "general",
    });

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error || "Agent returned an error" },
        { status: 502 },
      );
    }

    if (result.status === "timeout") {
      return NextResponse.json(
        { error: "Agent did not respond in time. Please try again." },
        { status: 504 },
      );
    }

    return NextResponse.json({
      status: "success",
      response: result.response,
    });
  } catch (err: any) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/agent
 * Health check — pings the deployed agent.
 */
export async function GET() {
  try {
    const health = await checkAgentHealth();
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json(
      { status: "unreachable", error: err.message },
      { status: 503 },
    );
  }
}
