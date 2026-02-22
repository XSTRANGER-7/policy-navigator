/**
 * POST /api/form16/premium
 *
 * Proxy to Form 16 Premium Agent (port 5007) which has ZyndAI native x402.
 *
 * Flow:
 *   1. No payment → agent returns HTTP 402 with ZyndAI x402 payment details
 *   2. Client pays USDC on Base, gets tx hash
 *   3. Client submits tx hash to POST /api/form16/pay → receives X-PAYMENT-RESPONSE header value
 *   4. Client retries this endpoint with { ...payload, x_payment_response: "<header>" }
 *   5. We forward X-PAYMENT-RESPONSE header → ZyndAI x402 middleware verifies → handler runs
 */

import { NextResponse } from "next/server";

const PREMIUM_AGENT_URL = process.env.FORM16_PREMIUM_AGENT_URL ?? "http://127.0.0.1:5007";

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const xPaymentResponse = String(body.x_payment_response ?? body.X_PAYMENT_RESPONSE ?? "");

    // Build headers — include payment header if provided
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (xPaymentResponse) {
      headers["X-PAYMENT-RESPONSE"] = xPaymentResponse;
    }

    const agentPayload = {
      prompt:       body.action ?? "generate_report",
      sender_id:    "web",
      message_type: "query",
      metadata:     body,
    };

    let res: Response;
    try {
      res = await fetch(`${PREMIUM_AGENT_URL}/webhook/sync`, {
        method:  "POST",
        headers,
        body:    JSON.stringify(agentPayload),
        signal:  AbortSignal.timeout(10_000),
      });
    } catch {
      return NextResponse.json({
        error:        "agent_offline",
        code:         503,
        message:      "Form 16 Premium Agent is not running. Start it with: .\\start-agents.ps1",
        premium_url:  PREMIUM_AGENT_URL,
      }, { status: 503 });
    }

    // Forward 402 from ZyndAI x402 middleware directly to client
    if (res.status === 402) {
      const paymentInfo = await res.json().catch(() => ({}));
      return NextResponse.json({
        ...paymentInfo as object,
        code:    402,
        agent:   "live",
        message: "Payment required. Use POST /api/form16/pay to get the payment header after sending USDC.",
      }, { status: 402 });
    }

    // Any other non-ok status
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `Agent HTTP ${res.status}` }));
      return NextResponse.json({ ...errData as object, agent: "live" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ ...data as object, agent: "live" });

  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}

/** GET /api/form16/premium — return agent info */
export async function GET() {
  return NextResponse.json({
    agent:          "Form 16 Premium Agent",
    url:            PREMIUM_AGENT_URL,
    payment:        "x402 (ZyndAI native)",
    price:          "$0.10 USDC per request",
    network:        "Base L2",
    asset:          "USDC",
    actions:        ["generate_report", "itr_prefill", "tds_reconcile"],
    payment_flow: [
      "1. POST /api/form16/premium with action → receive HTTP 402 + wallet address",
      "2. Send USDC to the wallet shown on Base network",
      "3. POST /api/form16/pay with { action, tx_hash } → receive x_payment_response",
      "4. POST /api/form16/premium with { action, x_payment_response, ...inputs } → receive report",
    ],
  });
}
