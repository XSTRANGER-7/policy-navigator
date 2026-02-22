"""
CIVIS AI — Form 16 Premium Agent  (port 5007)
==============================================
Paid premium actions for Form 16 Assistant.
ZyndAI x402 micropayment middleware is enabled via the `price` parameter in
AgentConfig — the SDK automatically handles 402 Payment Required responses
and verifies payment receipts before forwarding requests to the handler.

Paid Actions:
  generate_report  — Full tax computation report (new vs old regime comparison)
  itr_prefill      — Auto-populated ITR-1 (SAHAJ) form field values
  tds_reconcile    — Quarter-wise Form 16 vs Form 26AS TDS reconciliation

Price: $0.10 USDC per request (charged by ZyndAI x402 middleware)

Flow:
  1. Client calls POST /webhook/sync
  2. ZyndAI middleware checks for X-PAYMENT-RESPONSE header
  3. If missing → returns HTTP 402 with payment details (wallet, amount, network)
  4. Client sends USDC on Base network, gets payment receipt
  5. Client retries with X-PAYMENT-RESPONSE header
  6. Middleware verifies on-chain → handler is called → result returned
"""

from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, json, time, datetime

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5007))

config = AgentConfig(
    name="Form 16 Premium Agent",
    description="Paid premium Form 16 services: tax computation report, ITR-1 pre-fill draft, TDS reconciliation",
    capabilities={
        "services": ["tax_report", "itr_prefill", "tds_reconcile"],
        "ai":       ["tax_computation", "document_generation"],
        "protocols":["http", "x402"],
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY"),
    price="$0.10",           # ← ZyndAI native x402: SDK enables payment middleware automatically
    config_dir=".agent-form16-premium",   # separate DID / identity from the free agent
)

agent = ZyndAIAgent(agent_config=config)
print(f"[Form 16 Premium Agent] Running on port {port}")
print(f"[Form 16 Premium Agent] Agent ID : {agent.agent_id}")
print(f"[Form 16 Premium Agent] Price    : $0.10 USDC per request (x402)")


# ─── Tax Computation (shared logic) ──────────────────────────────────────────

NEW_REGIME_SLABS = [
    (300_000,   0.00),
    (600_000,   0.05),
    (900_000,   0.10),
    (1_200_000, 0.15),
    (1_500_000, 0.20),
    (float("inf"), 0.30),
]

OLD_REGIME_SLABS = [
    (250_000,      0.00),
    (500_000,      0.05),
    (1_000_000,    0.20),
    (float("inf"), 0.30),
]


def _compute_slabs(taxable: float, regime: str) -> float:
    slabs = NEW_REGIME_SLABS if regime == "new" else OLD_REGIME_SLABS
    prev, tax = 0, 0.0
    for limit, rate in slabs:
        if taxable <= prev:
            break
        tax += (min(taxable, limit) - prev) * rate
        prev = limit
    return tax


def _hra_exemption(basic: float, hra_recv: float, rent_paid: float, city: str) -> float:
    pct   = 0.50 if city == "metro" else 0.40
    rule2 = max(rent_paid - 0.10 * basic, 0)
    return max(min(hra_recv, rule2, pct * basic), 0)


def compute_full_tax(data: dict) -> dict:
    regime      = data.get("regime", "new").lower()
    gross       = float(data.get("gross_salary", 0))
    basic       = float(data.get("basic_salary", gross * 0.4))
    hra_recv    = float(data.get("hra_received", 0))
    rent_paid   = float(data.get("rent_paid", 0))
    city        = str(data.get("city_type", "metro")).lower()
    d80c        = float(data.get("deduction_80c", 0))
    d80d        = float(data.get("deduction_80d", 0))
    d80ccd      = float(data.get("deduction_80ccd1b", 0))
    d24b        = float(data.get("home_loan_interest", 0))
    prof_tax    = min(float(data.get("professional_tax", 0)), 2400)
    hra_exempt  = float(data.get("hra_exempt", 0))

    if hra_exempt == 0 and hra_recv > 0 and rent_paid > 0:
        hra_exempt = _hra_exemption(basic, hra_recv, rent_paid, city)

    if regime == "old":
        std_ded   = 50_000
        total_ded = std_ded + hra_exempt + min(d80c, 150_000) + min(d80d, 50_000) + min(d80ccd, 50_000) + min(d24b, 200_000) + prof_tax
        taxable   = max(gross - total_ded, 0)
    else:
        std_ded   = 75_000
        total_ded = std_ded + prof_tax
        taxable   = max(gross - total_ded, 0)

    tax_before = _compute_slabs(taxable, regime)

    if regime == "new" and taxable <= 700_000:
        rebate = tax_before
    elif regime == "old" and taxable <= 500_000:
        rebate = min(tax_before, 12_500)
    else:
        rebate = 0.0

    tax_after = max(tax_before - rebate, 0)
    cess      = round(tax_after * 0.04, 2)
    total_tax = round(tax_after + cess, 2)

    return {
        "gross_salary":       round(gross, 2),
        "total_deductions":   round(total_ded, 2),
        "hra_exempt":         round(hra_exempt, 2),
        "taxable_income":     round(taxable, 2),
        "tax_before_cess":    round(tax_before, 2),
        "rebate_87a":         round(rebate, 2),
        "tax_after_rebate":   round(tax_after, 2),
        "cess_4pct":          cess,
        "total_tax_payable":  total_tax,
        "monthly_tds":        round(total_tax / 12, 2),
        "effective_rate_pct": round((total_tax / gross) * 100, 2) if gross > 0 else 0,
        "regime":             regime,
        "fy":                 "2024-25",
        "ay":                 "2025-26",
    }


# ─── Extract request payload ──────────────────────────────────────────────────

def extract_payload(content) -> dict:
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}
    if isinstance(content, dict):
        return content.get("metadata", content)
    return {}


# ─── Message Handler ──────────────────────────────────────────────────────────
# ZyndAI x402 middleware runs BEFORE this handler.
# Requests that reach here have already been payment-verified by the SDK.

def message_handler(message: AgentMessage, topic: str):
    print("[Form 16 Premium Agent] Payment verified — processing request")
    payload = extract_payload(message.content)
    action  = payload.get("action", "generate_report")
    ts      = datetime.datetime.utcnow().isoformat() + "Z"

    # ── generate_report ───────────────────────────────────────────────────────
    if action == "generate_report":
        data_new = compute_full_tax({**payload, "regime": "new"})
        data_old = compute_full_tax({**payload, "regime": "old"})
        saving   = round(data_old["total_tax_payable"] - data_new["total_tax_payable"], 2)
        best     = "new" if data_new["total_tax_payable"] <= data_old["total_tax_payable"] else "old"

        agent.set_response(message.message_id, json.dumps({
            "action":             "generate_report",
            "report_title":       "Tax Computation Report — FY 2024-25 (AY 2025-26)",
            "generated_at":       ts,
            "employee_inputs":    {k: payload.get(k) for k in [
                "gross_salary", "basic_salary", "hra_received", "rent_paid",
                "city_type", "deduction_80c", "deduction_80d",
                "home_loan_interest", "deduction_80ccd1b",
            ] if payload.get(k)},
            "new_regime":         data_new,
            "old_regime":         data_old,
            "recommended_regime": best,
            "saving_vs_other":    abs(saving),
            "saving_label":       f"Save \u20b9{abs(saving):,.0f}/year by choosing {best.upper()} regime",
            "monthly_tds_new":    data_new["monthly_tds"],
            "monthly_tds_old":    data_old["monthly_tds"],
            "summary_lines": [
                f"Gross Salary:      \u20b9{data_new['gross_salary']:>12,.0f}",
                f"New Regime Tax:    \u20b9{data_new['total_tax_payable']:>12,.0f}  (TDS/month \u20b9{data_new['monthly_tds']:,.0f})",
                f"Old Regime Tax:    \u20b9{data_old['total_tax_payable']:>12,.0f}  (TDS/month \u20b9{data_old['monthly_tds']:,.0f})",
                f"Best Regime:       {best.upper()}  (saves \u20b9{abs(saving):,.0f}/year)",
            ],
            "payment_protocol":   "x402",
            "payment_verified":   True,
        }))

    # ── itr_prefill ───────────────────────────────────────────────────────────
    elif action == "itr_prefill":
        regime = payload.get("regime", "new").lower()
        tax    = compute_full_tax(payload)

        agent.set_response(message.message_id, json.dumps({
            "action":        "itr_prefill",
            "form":          "ITR-1 (SAHAJ)",
            "ay":            "AY 2025-26",
            "fy":            "FY 2024-25",
            "generated_at":  ts,
            "regime_opted":  regime,
            "schedule_s": {
                "gross_salary":      tax["gross_salary"],
                "standard_deduction": tax["total_deductions"],
                "net_salary":         tax["taxable_income"],
            },
            "schedule_via": {
                "80c":     min(float(payload.get("deduction_80c",    0)), 150_000),
                "80d":     min(float(payload.get("deduction_80d",    0)),  25_000),
                "80ccd1b": min(float(payload.get("deduction_80ccd1b",0)),  50_000),
                "total":   tax["total_deductions"],
            },
            "part_b_tti": {
                "total_income":        tax["taxable_income"],
                "tax_payable":         tax["tax_before_cess"],
                "rebate_87a":          tax["rebate_87a"],
                "tax_after_rebate":    tax["tax_after_rebate"],
                "cess_4pct":           tax["cess_4pct"],
                "total_tax_liability": tax["total_tax_payable"],
            },
            "tax_details": {
                "tds_by_employer":     float(payload.get("tds_deducted", tax["total_tax_payable"])),
                "self_assessment_due": max(round(tax["total_tax_payable"] - float(payload.get("tds_deducted", tax["total_tax_payable"])), 2), 0),
                "refund_due":          max(round(float(payload.get("tds_deducted", 0)) - tax["total_tax_payable"], 2), 0),
            },
            "filing_instructions": [
                "Go to https://www.incometax.gov.in \u2192 e-File \u2192 ITR \u2192 File ITR",
                "Select AY 2025-26, ITR-1 (SAHAJ), Online mode",
                "Copy schedule_s values into Part B-TI \u2192 Schedule S",
                "Copy schedule_via values into Chapter VI-A deductions",
                "Copy part_b_tti values into Part B-TTI tax computation",
                "Enter TDS from Form 16 Part A in the Tax Details tab",
                "e-Verify via Aadhaar OTP after submission",
            ],
            "payment_protocol": "x402",
            "payment_verified": True,
        }))

    # ── tds_reconcile ─────────────────────────────────────────────────────────
    elif action == "tds_reconcile":
        f16_q  = payload.get("form16_quarters", [])
        tr_q   = payload.get("traces_quarters", [])
        f16_tot = float(payload.get("form16_tds_total", sum(q.get("tds", 0) for q in f16_q)))
        tr_tot  = float(payload.get("traces_tds_total", sum(q.get("tds", 0) for q in tr_q)))
        diff    = round(f16_tot - tr_tot, 2)

        mismatches = []
        for i, (f, t) in enumerate(zip(f16_q, tr_q)):
            gap = round(float(f.get("tds", 0)) - float(t.get("tds", 0)), 2)
            if abs(gap) > 1:
                mismatches.append({"quarter": f.get("q", f"Q{i+1}"), "form16_tds": f.get("tds"), "traces_tds": t.get("tds"), "gap": gap})

        matched = abs(diff) < 2
        agent.set_response(message.message_id, json.dumps({
            "action":               "tds_reconcile",
            "generated_at":         ts,
            "form16_tds_total":      f16_tot,
            "traces_tds_total":      tr_tot,
            "difference":            diff,
            "status":                "MATCH" if matched else "MISMATCH",
            "quarter_mismatches":    mismatches,
            "verdict": (
                "\u2705 TDS in Form 16 matches Form 26AS. Safe to file ITR."
                if matched else
                f"\u26a0\ufe0f TDS mismatch of \u20b9{abs(diff):,.0f} detected in {len(mismatches)} quarter(s). Contact HR to revise 24Q."
            ),
            "next_steps": (
                ["No mismatch found. Proceed to file ITR."]
                if matched else [
                    f"Quarters with mismatch: {', '.join(m['quarter'] for m in mismatches)}",
                    "Share this report with HR/Finance to raise 24Q correction",
                    "Wait 7-15 days for correction to reflect in Form 26AS",
                    "Re-run reconciliation before filing ITR",
                ]
            ),
            "payment_protocol": "x402",
            "payment_verified": True,
        }))

    else:
        agent.set_response(message.message_id, json.dumps({
            "error": f"Unknown action: {action}",
            "valid_actions": ["generate_report", "itr_prefill", "tds_reconcile"],
            "note": "This is a paid agent — all requests require x402 USDC payment on Base network.",
        }))


agent.add_message_handler(message_handler)

print(f"[Form 16 Premium Agent] x402 payment middleware active")
print(f"[Form 16 Premium Agent] Use: agent.x402_processor.post('http://localhost:{port}/webhook/sync', json=payload)")

while True:
    time.sleep(60)
