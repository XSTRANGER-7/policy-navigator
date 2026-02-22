import { NextResponse } from "next/server";

const AGENT_URL = process.env.FORM16_AGENT_URL ?? "http://127.0.0.1:5006";

// ─── Tax slab computation (fallback when agent is offline) ───────────────────
const NEW_SLABS  = [[300_000,0],[600_000,.05],[900_000,.10],[1_200_000,.15],[1_500_000,.20],[Infinity,.30]];
const OLD_SLABS  = [[250_000,0],[500_000,.05],[1_000_000,.20],[Infinity,.30]];

function computeSlabs(income: number, slabs: number[][]): number {
  let prev = 0, tax = 0;
  for (const [limit, rate] of slabs) {
    if (income <= prev) break;
    tax += (Math.min(income, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

function taxCalc(p: Record<string, number | string>): Record<string, unknown> {
  const regime      = String(p.regime ?? "new").toLowerCase();
  const gross       = Number(p.gross_salary ?? 0);
  const basic       = Number(p.basic_salary ?? gross * 0.4);
  const hraRecv     = Number(p.hra_received ?? 0);
  const rentPaid    = Number(p.rent_paid ?? 0);
  const metro       = String(p.city_type ?? "metro") === "metro";
  const d80c        = Math.min(Number(p.deduction_80c ?? 0), 150_000);
  const d80d        = Math.min(Number(p.deduction_80d ?? 0), 50_000);
  const d80ccd      = Math.min(Number(p.deduction_80ccd1b ?? 0), 50_000);
  const d24b        = Math.min(Number(p.home_loan_interest ?? 0), 200_000);
  const profTax     = Math.min(Number(p.professional_tax ?? 0), 2400);
  const hraExemptIn = Number(p.hra_exempt ?? 0);

  // HRA exemption
  let hraEx = hraExemptIn;
  if (!hraEx && hraRecv && rentPaid) {
    const r2 = Math.max(rentPaid - 0.10 * basic, 0);
    const r3 = (metro ? 0.5 : 0.4) * basic;
    hraEx = Math.min(hraRecv, r2, r3);
  }

  let stdDed: number, totalDed: number, taxable: number;
  if (regime === "old") {
    stdDed    = 50_000;
    totalDed  = stdDed + hraEx + d80c + d80d + d80ccd + d24b + profTax;
    taxable   = Math.max(gross - totalDed, 0);
  } else {
    stdDed    = 75_000;
    totalDed  = stdDed + profTax;
    taxable   = Math.max(gross - totalDed, 0);
  }

  const slabs          = regime === "old" ? OLD_SLABS : NEW_SLABS;
  const taxBefore       = computeSlabs(taxable, slabs);
  const rebate          = regime === "new" && taxable <= 700_000
    ? taxBefore
    : regime === "old" && taxable <= 500_000 ? Math.min(taxBefore, 12_500) : 0;
  const taxAfterRebate  = Math.max(taxBefore - rebate, 0);
  const cess            = +(taxAfterRebate * 0.04).toFixed(2);
  const totalTax        = +(taxAfterRebate + cess).toFixed(2);

  return {
    gross_salary:      +gross.toFixed(2),
    total_deductions:  +totalDed.toFixed(2),
    hra_exempt:        +hraEx.toFixed(2),
    taxable_income:    +taxable.toFixed(2),
    tax_before_cess:   +taxBefore.toFixed(2),
    rebate_87a:        +rebate.toFixed(2),
    tax_after_rebate:  +taxAfterRebate.toFixed(2),
    cess_4pct:         cess,
    total_tax_payable: totalTax,
    monthly_tds:       +(totalTax / 12).toFixed(2),
    effective_rate_pct: gross > 0 ? +((totalTax / gross) * 100).toFixed(2) : 0,
    regime, fy: "2024-25", ay: "2025-26",
  };
}

// ─── Try the Python agent, fall back to inline computation ───────────────────
async function callAgent(body: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(`${AGENT_URL}/webhook/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: body.action ?? "form16",
        sender_id: "web",
        message_type: "query",
        metadata: body,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`agent ${res.status}`);
    return await res.json();
  } catch {
    return null; // agent offline — use inline fallback
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action ?? "explain");

    // Try live agent first
    const agentResp = await callAgent(body);
    if (agentResp) {
      return NextResponse.json({ ...agentResp as object, agent: "live" });
    }

    // ── Fallback inline handlers ──────────────────────────────────────────────
    if (action === "tax_calc") {
      return NextResponse.json({ ...taxCalc(body as Record<string, number | string>), action: "tax_calc", agent: "inline" });
    }

    if (action === "hra_exempt") {
      const basic   = Number(body.basic_salary ?? 0);
      const hraRecv = Number(body.hra_received ?? 0);
      const rent    = Number(body.rent_paid    ?? 0);
      const metro   = String(body.city_type ?? "metro") === "metro";
      if (!basic || !hraRecv || !rent) {
        return NextResponse.json({ error: "Provide basic_salary, hra_received, rent_paid, city_type" }, { status: 400 });
      }
      const r1 = hraRecv, r2 = Math.max(rent - 0.10*basic,0), r3 = (metro?0.5:0.4)*basic;
      const ex = +Math.min(r1,r2,r3).toFixed(2);
      return NextResponse.json({ action:"hra_exempt", rule1_hra_recvd:+r1.toFixed(2), rule2_rent_minus_10pct_basic:+r2.toFixed(2), rule3_pct_basic:+r3.toFixed(2), hra_exempt:ex, hra_taxable:+(hraRecv-ex).toFixed(2), agent:"inline" });
    }

    // For all knowledge-base / guide actions, return a flag so frontend uses built-in content
    return NextResponse.json({ action, agent: "offline", fallback: true });

  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
