import type { AgentPipelineResponse } from "@/types/citizen";

const AGENT_BASE_URL =
  process.env.POLICY_AGENT_URL ?? "https://policy-navigator-fozt.onrender.com";

/**
 * Fire-and-forget call to the Citizen Agent (async webhook).
 * Used after saving a citizen record — no wait for response.
 */
export async function callCitizenAgent(payload: any): Promise<boolean> {
  const url = `${AGENT_BASE_URL}/webhook`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: JSON.stringify(payload),
        sender_id: "policy-navigator-web",
        message_type: "query",
        metadata: payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Synchronous call to the Citizen Agent orchestrator.
 * Returns the full AgentPipelineResponse (ranked schemes + VC).
 */
export async function callCitizenAgentSync(payload: {
  citizenId?: string;
  age: number;
  income: number;
  state: string;
  category: string;
  email?: string;
}): Promise<{ status: string; response?: AgentPipelineResponse | string; error?: string }> {
  const url = `${AGENT_BASE_URL}/webhook/sync`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: JSON.stringify(payload),
      sender_id: "policy-navigator-web",
      message_type: "query",
      metadata: payload,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Agent sync call failed:", text);
    return { status: "error", error: text };
  }

  const data = await res.json();

  // The orchestrator returns json.dumps(result) so response is a JSON string.
  // Parse it into a structured object if possible.
  let response = data.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response) as AgentPipelineResponse;
    } catch {
      // Leave as plain string (legacy/error message)
    }
  }

  return { status: "success", response };
}

/**
 * Health check — pings the Citizen Agent.
 */
export async function checkAgentHealth(): Promise<{
  status: string;
  agent_id?: string;
}> {
  const url = `${AGENT_BASE_URL}/health`;
  const res = await fetch(url);
  return res.json();
}
