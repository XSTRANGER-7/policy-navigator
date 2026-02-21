const AGENT_BASE_URL =
  process.env.POLICY_AGENT_URL ?? "https://policy-navigator-fozt.onrender.com";

/**
 * Fire-and-forget call to the deployed Policy Navigator agent (async webhook).
 * Used when you don't need to wait for the agent's response.
 */
export async function callCitizenAgent(payload: any) {
  const url = `${AGENT_BASE_URL}/webhook`;

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
    console.error("Failed to call Citizen Agent (async)", await res.text());
  }

  return res.ok;
}

/**
 * Synchronous call to the deployed Policy Navigator agent.
 * Sends the citizen data and waits up to 30s for eligibility response.
 */
export async function callCitizenAgentSync(payload: {
  citizenId?: string;
  age: number;
  income: number;
  state: string;
  category: string;
}): Promise<{ status: string; response?: string; error?: string }> {
  const url = `${AGENT_BASE_URL}/webhook/sync`;

  const prompt = `Check policy eligibility for a citizen with the following details:
- Age: ${payload.age}
- Annual Income: ₹${payload.income}
- State: ${payload.state}
- Category: ${payload.category}
Please list all eligible government schemes and benefits.`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
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

  return res.json();
}

/**
 * Health check for the deployed agent.
 */
export async function checkAgentHealth(): Promise<{
  status: string;
  agent_id?: string;
}> {
  const url = `${AGENT_BASE_URL}/health`;
  const res = await fetch(url);
  return res.json();
}
