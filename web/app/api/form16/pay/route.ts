/**
 * POST /api/form16/pay
 *
 * x402 Payment Receipt Builder for Form 16 Premium Agent (ZyndAI native x402).
 *
 * The ZyndAI x402 middleware on the premium agent (port 5007) expects an
 * X-PAYMENT-RESPONSE header with a base64-encoded payment receipt.
 *
 * This route:
 *   1. Receives the on-chain transaction hash from the user
 *   2. (Production) Verifies the tx on Base network via eth_getTransactionReceipt
 *   3. Constructs an x402-compliant payment receipt (scheme: "exact", network: base-mainnet)
 *   4. Returns x_payment_response so the client attaches it to the next /premium request
 */

import { NextResponse } from "next/server";

const PAYMENT_WALLET = process.env.PAYMENT_WALLET_ADDRESS ?? "0xYourProjectWalletAddressHere";
const BASE_RPC_URL   = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

const PAID_ACTIONS: Record<string, { price_usdc: number; price_units: string; description: string }> = {
  generate_report: { price_usdc: 0.10, price_units: "100000", description: "Tax Computation Report" },
  itr_prefill:     { price_usdc: 0.25, price_units: "250000", description: "ITR-1 Pre-fill Draft" },
  tds_reconcile:   { price_usdc: 0.15, price_units: "150000", description: "TDS Reconciliation Report" },
};

function isValidTxHash(tx: string): boolean {
  const clean = tx.startsWith("0x") ? tx.slice(2) : tx;
  return clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean);
}

function normaliseTx(tx: string): string {
  return tx.startsWith("0x") ? tx : `0x${tx}`;
}

/**
 * Build x402-compatible payment receipt.
 * Base64-encoded JSON in x402 "exact" scheme format.
 * ZyndAI's SDK validates this against its configured Coinbase CDP verifier.
 */
function buildPaymentReceipt(txHash: string, action: string): string {
  const info = PAID_ACTIONS[action];
  const receipt = {
    x402Version: 1,
    scheme:      "exact",
    network:     "base-mainnet",
    payload: {
      txHash:      normaliseTx(txHash),
      to:          PAYMENT_WALLET,
      value:       info.price_units,  // USDC 6-decimal units
      asset:       "USDC",
      description: info.description,
    },
  };
  return Buffer.from(JSON.stringify(receipt)).toString("base64");
}

export async function POST(req: Request) {
  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = String(body.action  ?? "");
    const txHash = String(body.tx_hash ?? body.txHash ?? "");

    if (!PAID_ACTIONS[action]) {
      return NextResponse.json({ error: "Invalid action", valid: Object.keys(PAID_ACTIONS) }, { status: 400 });
    }
    if (!isValidTxHash(txHash)) {
      return NextResponse.json({
        error:   "Invalid transaction hash",
        detail:  "Provide a Base network tx hash — 64 hex chars with or without 0x prefix",
        example: "0xabcdef1234567890...64hexchars",
      }, { status: 400 });
    }

    // ── Production: verify on Base via JSON-RPC ───────────────────────────────
    // Uncomment + configure BASE_RPC_URL to enable real on-chain verification:
    //
    // const rpc = await fetch(BASE_RPC_URL, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     jsonrpc: "2.0", id: 1,
    //     method: "eth_getTransactionReceipt",
    //     params: [normaliseTx(txHash)],
    //   }),
    //   signal: AbortSignal.timeout(6000),
    // });
    // const { result: receipt } = await rpc.json();
    // if (!receipt || receipt.status !== "0x1") {
    //   return NextResponse.json({ error: "Transaction not confirmed on Base network" }, { status: 402 });
    // }
    // ─────────────────────────────────────────────────────────────────────────

    const info               = PAID_ACTIONS[action];
    const x_payment_response = buildPaymentReceipt(txHash, action);

    return NextResponse.json({
      ok:                  true,
      action,
      tx_hash:             normaliseTx(txHash),
      price_usdc:          info.price_usdc,
      description:         info.description,
      x_payment_response,  // attach this in the next /api/form16/premium request body
      next_step: {
        url:  "/api/form16/premium",
        body: `{ "action": "${action}", "x_payment_response": "<above value>", ...your_inputs }`,
      },
    });

  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    payment_wallet: PAYMENT_WALLET,
    network:        "Base L2 (base-mainnet)",
    asset:          "USDC",
    protocol:       "x402 — ZyndAI native (price= in AgentConfig)",
    premium_agent:  "http://localhost:5007",
    paid_actions:   Object.entries(PAID_ACTIONS).map(([action, info]) => ({
      action, price_usdc: info.price_usdc, description: info.description,
    })),
    flow: [
      "1. POST /api/form16/premium { action } → HTTP 402 from ZyndAI x402 middleware",
      `2. Send USDC to ${PAYMENT_WALLET} on Base network`,
      "3. POST /api/form16/pay { action, tx_hash } → receive x_payment_response",
      "4. POST /api/form16/premium { action, x_payment_response, ...inputs } → report",
    ],
  });
}
