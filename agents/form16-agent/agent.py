"""
CIVIS AI — Form 16 Agent  (port 5006)
======================================
Helps salaried employees understand, verify, and file using Form 16.

Actions handled via metadata.action:
  explain          — What is Form 16, Part A vs Part B
  tax_calc         — Compute income tax & TDS liability from salary inputs
  section_guide    — Explanation of any Income Tax section (80C, 80D, 87A …)
  checklist        — Documents / data points needed to file ITR
  filing_steps     — Step-by-step ITR-1 / ITR-2 walkthrough
  tds_mismatch     — What to do when employer TDS != Form 26AS TDS
  two_employers    — Handling two Form 16s in the same FY
  download_guide   — How to download Form 16 from TRACES portal
  hra_exempt       — Calculate HRA exemption
  query            — Free-text FAQ (LLM-powered Indian income tax expert)
"""

from flask import Flask, request, jsonify
from dotenv import load_dotenv
from pathlib import Path
import os, json, time, math, uuid

try:
    from openai import OpenAI as _OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5006))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_llm = _OpenAI(api_key=OPENAI_API_KEY) if (_openai_available and OPENAI_API_KEY) else None

agent_id = f"agent:form-16-agent:{uuid.uuid4().hex[:6]}"

app = Flask("Form 16 Agent")
print(f"[Form 16 Agent] Running on port {port} | ID: {agent_id}")



# ─── Tax Slabs FY 2024-25 (New Regime default) ────────────────────────────────
NEW_REGIME_SLABS = [
    (300_000,  0.00),
    (600_000,  0.05),
    (900_000,  0.10),
    (1_200_000, 0.15),
    (1_500_000, 0.20),
    (float("inf"), 0.30),
]

OLD_REGIME_SLABS = [
    (250_000,  0.00),
    (500_000,  0.05),
    (1_000_000, 0.20),
    (float("inf"), 0.30),
]

STANDARD_DEDUCTION = 75_000   # FY 2024-25 new regime
REBATE_87A_LIMIT   = 700_000  # new regime


def compute_tax(taxable: float, regime: str = "new") -> float:
    """Compute tax before cess using slab rates."""
    slabs  = NEW_REGIME_SLABS if regime == "new" else OLD_REGIME_SLABS
    prev   = 0
    tax    = 0.0
    for limit, rate in slabs:
        if taxable <= prev:
            break
        applicable = min(taxable, limit) - prev
        tax += applicable * rate
        prev = limit
    return tax


def compute_full_tax(data: dict) -> dict:
    regime          = data.get("regime", "new").lower()
    gross_salary    = float(data.get("gross_salary", 0))
    hra_exempt      = float(data.get("hra_exempt", 0))
    other_exemptions= float(data.get("other_exemptions", 0))  # LTA, gratuity, etc.
    basic_80c       = float(data.get("deduction_80c", 0))      # max 1.5L
    deduction_80d   = float(data.get("deduction_80d", 0))      # max 25K/50K
    deduction_80ccd = float(data.get("deduction_80ccd1b", 0))  # NPS tier 1, max 50K
    nps_employer    = float(data.get("nps_employer", 0))       # 10% of basic, old regime
    home_loan_int   = float(data.get("home_loan_interest", 0)) # 24(b), max 2L
    hra_received    = float(data.get("hra_received", 0))
    basic_salary    = float(data.get("basic_salary", gross_salary * 0.4))
    rent_paid       = float(data.get("rent_paid", 0))
    city_type       = str(data.get("city_type", "metro")).lower()

    # Professional Tax (max 2400)
    prof_tax = min(float(data.get("professional_tax", 0)), 2400)

    # Compute HRA exemption if not provided
    if hra_exempt == 0 and hra_received > 0 and rent_paid > 0:
        hra_exempt = _hra_exemption(basic_salary, hra_received, rent_paid, city_type)

    # ─ Old Regime deductions ─
    if regime == "old":
        std_deduction = 50_000
        d80c  = min(basic_80c, 150_000)
        d80d  = min(deduction_80d, 50_000)
        d80ccd= min(deduction_80ccd, 50_000)
        d24b  = min(home_loan_int, 200_000)
        dnps  = min(nps_employer, 0.10 * basic_salary)
        total_deductions = std_deduction + hra_exempt + other_exemptions + d80c + d80d + d80ccd + d24b + dnps + prof_tax
        taxable = max(gross_salary - total_deductions, 0)
        tax_before_cess = compute_tax(taxable, "old")
    else:
        # New Regime — most deductions not allowed
        std_deduction    = STANDARD_DEDUCTION
        total_deductions = std_deduction + prof_tax
        taxable          = max(gross_salary - total_deductions, 0)
        tax_before_cess  = compute_tax(taxable, "new")

    # 87A rebate (new regime: income ≤ 7L → zero tax)
    if regime == "new" and taxable <= REBATE_87A_LIMIT:
        rebate  = tax_before_cess
    elif regime == "old" and taxable <= 500_000:
        rebate  = min(tax_before_cess, 12_500)
    else:
        rebate  = 0.0

    tax_after_rebate = max(tax_before_cess - rebate, 0)
    cess             = round(tax_after_rebate * 0.04, 2)
    total_tax        = round(tax_after_rebate + cess, 2)
    monthly_tds      = round(total_tax / 12, 2)
    effective_rate   = round((total_tax / gross_salary) * 100, 2) if gross_salary > 0 else 0

    return {
        "gross_salary":       round(gross_salary, 2),
        "total_deductions":   round(total_deductions, 2),
        "hra_exempt":         round(hra_exempt, 2),
        "taxable_income":     round(taxable, 2),
        "tax_before_cess":    round(tax_before_cess, 2),
        "rebate_87a":         round(rebate, 2),
        "tax_after_rebate":   round(tax_after_rebate, 2),
        "cess_4pct":          cess,
        "total_tax_payable":  total_tax,
        "monthly_tds":        monthly_tds,
        "effective_rate_pct": effective_rate,
        "regime":             regime,
        "fy":                 "2024-25",
        "ay":                 "2025-26",
    }


def _hra_exemption(basic: float, hra_received: float, rent_paid: float, city: str) -> float:
    """Least of three HRA exemption rules."""
    city_pct  = 0.50 if city == "metro" else 0.40
    rule1     = hra_received
    rule2     = rent_paid - (0.10 * basic)
    rule3     = city_pct * basic
    return max(min(rule1, max(rule2, 0), rule3), 0)


# ─── Knowledge Base ───────────────────────────────────────────────────────────
EXPLAIN = {
    "what_is": """
Form 16 is a TDS (Tax Deducted at Source) certificate issued by your employer under Section 203 of the Income Tax Act.
It is a crucial document for salaried employees to file their Income Tax Return (ITR).

📋 KEY FACTS:
• Issued by: Your employer (every year by 15th June)
• For period: Previous Financial Year (Apr–Mar)
• Format: Part A + Part B

📂 PART A — TDS Summary (generated directly from TRACES portal):
  • Employer's TAN, employee's PAN
  • Quarter-wise TDS deducted and deposited
  • Verification from Income Tax Department

📂 PART B — Salary Breakup (prepared by employer):
  • Gross salary, allowances, perquisites
  • All exemptions (HRA, LTA, standard deduction)
  • Deductions under Chapter VI-A (80C, 80D, etc.)
  • Net taxable income & total TDS

⚠️ IMPORTANT: Part A must be DOWNLOADED FROM TRACES (not just printed by employer). Part B is employer-prepared.
""",
    "part_a": """
📂 FORM 16 — PART A (TRACES Generated)

Contains:
  1. Employer's Name, Address & TAN
  2. Employee's Name, Address & PAN
  3. Assessment Year (AY)
  4. Quarter-wise summary:
     - Date of payment to government
     - TDS certificate numbers (form 27A)
     - Amount of TDS deducted each quarter

How to verify Part A:
  → Go to TRACES portal (https://www.tdscpc.gov.in)
  → Login with your PAN → Go to View TDS → 26AS / AIS
  → Match the TDS figures with your Form 16 Part A

If TDS in Part A ≠ Form 26AS: Contact HR immediately to rectify the mismatch.
""",
    "part_b": """
📂 FORM 16 — PART B (Employer Prepared)

Sections covered:
  1. Gross Salary
     - Basic Pay
     - House Rent Allowance (HRA)
     - Special Allowance, Conveyance, Medical
     - Leave Travel Allowance (LTA)

  2. Less: Exemptions u/s 10
     - HRA Exemption [u/s 10(13A)]
     - Leave Encashment, Gratuity exemptions
     - Standard Deduction ₹75,000 (FY 24-25, new regime)

  3. Net Salary

  4. Less: Chapter VI-A Deductions (old regime)
     - 80C: PPF, ELSS, LIC, EPF, NSC — Max ₹1.5 lakh
     - 80D: Health Insurance — Max ₹25K (₹50K for parents)
     - 80CCD(1B): NPS Tier 1 — Max ₹50K
     - 80G: Donations

  5. Taxable Income

  6. Tax on Taxable Income
     - Less: Section 87A Rebate
     - Add: 4% Health & Education Cess
     - Less: Relief u/s 89 (for arrears)

  7. TDS Deposited
""",
}

SECTION_GUIDE = {
    "80c": {
        "name": "Section 80C — Tax-saving Investments",
        "limit": "₹1,50,000 per year (old regime only)",
        "items": [
            "EPF (Employee Provident Fund) contributions — automatic",
            "PPF (Public Provident Fund) — plan ahead",
            "Life Insurance premiums (LIC, term plans)",
            "ELSS Mutual Funds (3-year lock-in, best returns)",
            "NSC (National Savings Certificate)",
            "Home Loan Principal Repayment",
            "Children's Tuition Fees",
            "5-Year Bank FD",
            "Sukanya Samriddhi Yojana",
        ],
        "tip": "EPF + LIC usually exhaust most of 80C. Check your salary slip — EPF employee contribution counts.",
    },
    "80d": {
        "name": "Section 80D — Health Insurance Premiums",
        "limit": "Self+family: ₹25,000 | Parents (senior): ₹50,000 | Max total: ₹75,000",
        "items": [
            "Health insurance premium for self, spouse, children: up to ₹25,000",
            "Health insurance premium for parents (< 60 years): ₹25,000",
            "Health insurance premium for senior citizen parents: ₹50,000",
            "Preventive health check-up: ₹5,000 (within 80D limit)",
        ],
        "tip": "Buy a family floater health plan. Premium qualifies fully under 80D.",
    },
    "80ccd": {
        "name": "Section 80CCD(1B) — NPS Additional Deduction",
        "limit": "₹50,000 — OVER and ABOVE the ₹1.5L 80C limit",
        "items": [
            "NPS Tier 1 account voluntary contributions",
            "Eligible for all salaried employees with NPS / Atal Pension Yojana",
        ],
        "tip": "Invest ₹50,000/year in NPS Tier 1 to save extra ₹15,000 tax (30% bracket).",
    },
    "24b": {
        "name": "Section 24(b) — Home Loan Interest Deduction",
        "limit": "Self-occupied: ₹2,00,000 | Let-out: Actual interest paid",
        "items": [
            "Interest on home loan for self-occupied or rented property",
            "Pre-construction interest deductible in 5 equal installments after construction",
        ],
        "tip": "Take interest certificate from your bank every year before March.",
    },
    "87a": {
        "name": "Section 87A — Tax Rebate",
        "limit": "New regime: taxable income ≤ ₹7,00,000 → ZERO TAX | Old regime: ≤ ₹5,00,000",
        "items": [
            "Rebate equals full tax payable (up to limits above)",
            "Effective: no tax if new regime income ≤ ₹7 lakh",
            "4% cess still applies after rebate calculation in some edge cases",
        ],
        "tip": "If your income is just above ₹7L in new regime, check if maximising deductions brings you under the limit.",
    },
    "10": {
        "name": "Section 10 — Exemptions",
        "limit": "Various — part of gross salary exempt from tax",
        "items": [
            "10(13A): HRA exemption — least of: HRA received / rent paid − 10% of basic / 50% (metro) or 40% basic",
            "10(5): LTA — 2 journeys in 4-year block, economy airfare or train fare",
            "10(10): Gratuity — tax-free up to ₹20 lakh",
            "10(10AA): Leave Encashment — tax-free up to ₹25 lakh on retirement",
            "10(14): Conveyance, uniform, research allowances (partially exempt)",
        ],
        "tip": "Claim HRA and LTA proactively — submit proof to employer before March.",
    },
    "89": {
        "name": "Section 89 — Relief for Salary Arrears",
        "limit": "No upper limit; proportional tax relief",
        "items": [
            "If you received arrears or advance salary in current year belonging to past years",
            "Compute tax with and without arrears",
            "File Form 10E online before filing ITR to claim this relief",
        ],
        "tip": "Always file Form 10E BEFORE filing ITR if you received arrears. Else relief is denied.",
    },
}

FILING_STEPS = [
    {
        "step": 1,
        "title": "Collect Documents",
        "tasks": [
            "Form 16 Part A (from TRACES) + Part B (from employer)",
            "Form 26AS / AIS / TIS from Income Tax portal",
            "Bank interest certificates, Fixed Deposit interest statements",
            "Investment proofs: LIC, PPF, ELSS, NPS, school fees receipts",
            "Home loan interest certificate (for 24b)",
            "Rent receipts + landlord PAN (for HRA exemption claim)",
            "Capital gains statements from broker (if applicable)",
        ],
    },
    {
        "step": 2,
        "title": "Verify Form 26AS & AIS",
        "tasks": [
            "Login to https://www.incometax.gov.in → e-File → Income Tax Return",
            "Under 'View Form 26AS' — check all TDS entries match your Form 16 Part A",
            "Open AIS (Annual Information Statement) — check all income sources",
            "If mismatch found: contact employer / bank. Do NOT file until resolved.",
        ],
    },
    {
        "step": 3,
        "title": "Choose Your ITR Form",
        "tasks": [
            "ITR-1 (SAHAJ): Salary + one house property + other sources ≤ ₹50L → simplest",
            "ITR-2: Capital gains, foreign income, multiple properties",
            "ITR-3: Business/profession income along with salary",
            "Most salaried employees use ITR-1 unless they have capital gains",
        ],
    },
    {
        "step": 4,
        "title": "Choose Tax Regime",
        "tasks": [
            "New Regime (default): Standard deduction ₹75K, lower slabs, minimal exemptions",
            "Old Regime: Higher slabs but 80C, 80D, HRA, 24(b) deductions allowed",
            "Run the CIVIS Tax Calculator to compare both regimes",
            "Once new regime is chosen in a FY, you can switch only at the start of next FY",
        ],
    },
    {
        "step": 5,
        "title": "File on Income Tax Portal",
        "tasks": [
            "Go to https://www.incometax.gov.in → e-File → Income Tax Return → File ITR",
            "Select AY (Assessment Year) — for FY 2024-25, select AY 2025-26",
            "Choose 'Online Mode'. Most data pre-filled from Form 26AS",
            "Verify salary details from Form 16 Part B — update any missing figures",
            "Enter all deductions (80C, 80D etc.) in the deductions tab",
            "Confirm tax liability / refund amount",
            "Proceed to verification: e-Verify via Aadhaar OTP (fastest)",
        ],
    },
    {
        "step": 6,
        "title": "E-Verify Your Return",
        "tasks": [
            "Aadhaar OTP (instant, recommended)",
            "Net Banking",
            "Demat Account",
            "EVC via Bank ATM",
            "OR: Send signed ITR-V by post to CPC Bengaluru within 30 days",
        ],
    },
    {
        "step": 7,
        "title": "Track Your Refund",
        "tasks": [
            "Login to IT portal → e-File → ITR → View Filed Returns",
            "Refund (if any) credited to pre-validated bank account within 20–45 days",
            "Check NSDL refund status: https://tin.tin.nsdl.com/oltas/refundstatuslogin.html",
            "Intimation u/s 143(1) will arrive on registered email post-processing",
        ],
    },
]

CHECKLIST = [
    {"item": "Form 16 Part A",                   "source": "Download from TRACES portal — employer must provide link or PDF"},
    {"item": "Form 16 Part B",                   "source": "Provided by your employer (Excel/PDF)"},
    {"item": "Form 26AS",                        "source": "IT portal → e-File → Income Tax Return → View Form 26AS"},
    {"item": "AIS (Annual Information Statement)","source": "IT portal → Services → Annual Information Statement"},
    {"item": "PAN Card",                         "source": "NSDL / UTIITSL"},
    {"item": "Aadhaar Card",                     "source": "UIDAI — must be linked to PAN"},
    {"item": "Bank Account (pre-validated)",     "source": "IT portal → My Profile → Bank Account → Pre-validate"},
    {"item": "Investment Proofs (80C)",          "source": "LIC policy, PPF passbook, ELSS statement, tuition receipts"},
    {"item": "Health Insurance Premium Receipt (80D)", "source": "Your insurance company"},
    {"item": "Home Loan Interest Certificate",  "source": "Bank/NBFC — request by March every year"},
    {"item": "Rent Receipts + Landlord PAN",    "source": "Required if HRA claim > ₹1 lakh/year"},
    {"item": "NPS Statement (80CCD)",           "source": "NSDL CRA / eNPS login"},
    {"item": "Capital Gains Statement",         "source": "Broker's tax P&L report (Zerodha, Groww, etc.)"},
]

FAQ = {
    "trace":        "Download Form 16 from TRACES: Your employer must log in to https://www.tdscpc.gov.in → Statements / Payments → Form 16 → Download. Alternatively ask HR to share the TRACES-generated PDF.",
    "two form16":   "If you changed jobs in the same FY, you'll have TWO Form 16s. Add both gross salaries, both TDS amounts. File ONE ITR with combined income. Make sure neither employer double-counted the standard deduction.",
    "mismatch":     "If Form 16 TDS ≠ Form 26AS TDS: Contact your employer immediately. They must revise the TDS return (24Q) via their CA or SR. Do NOT file ITR until the mismatch is resolved — IT dept uses Form 26AS, not Form 16.",
    "standard deduction": "Standard Deduction is ₹75,000 for employees in FY 2024-25 (new regime). It's automatically applied — you don't need any proof or investment.",
    "new vs old":   "New regime (default): Standard Deduction ₹75K, lower slabs (5%/10%/15%/20%/30%), fewer deductions. Old regime: ₹50K std deduction + HRA + 80C + 80D + 24b + many more. Run our calculator to compare.",
    "refund":       "Excess TDS deducted by employer is refunded by IT dept after you file ITR. Refunds take 20-45 days post e-verification. Make sure bank account is pre-validated on IT portal.",
    "deadline":     "ITR filing deadline: July 31 every year (for salaried, non-audit). Belated returns can be filed until December 31 with ₹5,000 penalty. Never miss July 31 — interest u/s 234A applies.",
    "hra":          "HRA exemption = least of: (1) Actual HRA received, (2) Rent paid − 10% of Basic, (3) 50% of Basic (metro) / 40% Basic (non-metro). If you live with parents and pay rent to them legally, you can claim HRA. Parents must declare it as rental income.",
    "nps":          "NPS investment under 80CCD(1B) gives additional ₹50,000 deduction OVER the ₹1.5L 80C limit — old regime only. New regime doesn't allow this deduction.",
    "gratuity":     "Gratuity received on retirement/resignation is tax-free up to ₹20 lakh (for covered employees). Ensure Part B shows it under Section 10(10) exemption.",
    "form 10e":     "File Form 10E ONLINE on IT portal BEFORE filing ITR if you received salary arrears. Without 10E, Section 89 relief is denied even if it shows in your return.",
}


# ─── Handler Helpers ──────────────────────────────────────────────────────────

def extract_payload(content) -> dict:
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}
    if isinstance(content, dict):
        return content.get("metadata", content)
    return {}


def handle_query(text: str) -> str:
    """LLM-powered Indian income tax expert. Falls back to keyword matching if no API key."""
    if _llm:
        try:
            resp = _llm.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert Indian income tax advisor specializing in Form 16, "
                            "TDS, ITR filing for salaried employees, and all sections of the "
                            "Income Tax Act 1961. You know FY 2024-25 rules, new vs old regime, "
                            "Section 80C/80D/87A/HRA/NPS, TRACES portal, Form 26AS, and AIS. "
                            "Give accurate, practical answers. Be concise (3-5 sentences max). "
                            "Always mention relevant section numbers or form names when applicable."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                max_tokens=300,
                temperature=0.3,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"[Form 16 Agent][LLM] {e}")
            # fall through to keyword matching

    # ── Keyword fallback (no API key or LLM error) ────────────────────────
    text_l = text.lower()
    for keyword, answer in FAQ.items():
        if keyword in text_l:
            return f"💡 {answer}"
    return (
        "I can help with Form 16 topics. Try asking about:\n"
        "• What is Form 16 / Part A / Part B\n"
        "• How to download Form 16 from TRACES\n"
        "• Two Form 16s from two employers\n"
        "• TDS mismatch with Form 26AS\n"
        "• Section 80C, 80D, 87A, HRA, NPS\n"
        "• How to file ITR-1 step by step\n"
        "• New vs Old tax regime\n"
        "• Standard deduction, gratuity, arrears (Form 10E)\n"
        "• Tax refund status"
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok", "agent": "Form 16 Agent", "agent_id": agent_id})


@app.post("/webhook")
@app.post("/webhook/sync")
@app.post("/process")
def process():
    body = request.get_json(force=True, silent=True) or {}
    message_id = body.get("message_id") or str(uuid.uuid4())

    print("[Form 16 Agent] Received request")
    payload = extract_payload(body)
    action  = payload.get("action", "explain")

    if action == "explain":
        sub = payload.get("sub", "what_is")
        res = {
            "action": "explain",
            "sub":    sub,
            "content": EXPLAIN.get(sub, EXPLAIN["what_is"]).strip(),
        }
    elif action == "tax_calc":
        res = compute_full_tax(payload)
        res["action"] = "tax_calc"
    elif action == "section_guide":
        section = payload.get("section", "80c").lower().replace("section", "").strip()
        info    = SECTION_GUIDE.get(section)
        if not info:
            res = {
                "error": f"Section '{section}' not found.",
                "available": list(SECTION_GUIDE.keys()),
            }
        else:
            res = {"action": "section_guide", "section": section, **info}
    elif action == "checklist":
        res = {
            "action":    "checklist",
            "checklist": CHECKLIST,
            "total":     len(CHECKLIST),
            "message":   "Keep all documents ready before starting ITR filing.",
        }
    elif action == "filing_steps":
        res = {
            "action":       "filing_steps",
            "steps":        FILING_STEPS,
            "total_steps":  len(FILING_STEPS),
            "deadline":     "July 31, 2025 (for AY 2025-26)",
            "itr_form":     "Most salaried employees -> ITR-1 (SAHAJ)",
            "portal":       "https://www.incometax.gov.in",
        }
    elif action == "tds_mismatch":
        res = {
            "action": "tds_mismatch",
            "problem": "Form 16 TDS amount does not match Form 26AS / AIS",
            "causes": [
                "Employer delayed depositing TDS with government",
                "Employer filed wrong TAN or wrong PAN in TDS return (24Q)",
                "Quarter payment not reflected yet (takes ~10 days after deposit)",
            ],
            "steps": [
                "1. Compare TDS certificate-wise in Form 26AS vs Form 16 Part A",
                "2. Note exact mismatch amount and quarter",
                "3. Email HR/Finance with the discrepancy details",
                "4. Employer must revise 24Q TDS return via their tax consultant",
                "5. Wait for correction to reflect in Form 26AS (7-15 days)",
                "6. ONLY then proceed to file ITR",
            ],
            "warning": "Do NOT file ITR with a mismatch. IT dept processes TDS from Form 26AS, not from Form 16. You may get a demand notice.",
            "escalation": "If employer refuses/delays beyond June 30 before July 31 deadline, consult a CA or raise grievance at https://www.incometax.gov.in -> e-Nivaran.",
        }
    elif action == "two_employers":
        g1    = float(payload.get("gross_salary_1", 0))
        tds1  = float(payload.get("tds_1", 0))
        g2    = float(payload.get("gross_salary_2", 0))
        tds2  = float(payload.get("tds_2", 0))
        combined_gross = g1 + g2
        combined_tds   = tds1 + tds2
        combined_result = compute_full_tax({**payload, "gross_salary": combined_gross})
        diff = round(combined_result["total_tax_payable"] - combined_tds, 2)
        res = {
            "action":             "two_employers",
            "employer1_gross":    g1,
            "employer2_gross":    g2,
            "combined_gross":     combined_gross,
            "combined_tds":       combined_tds,
            "tax_on_combined":    combined_result["total_tax_payable"],
            "tax_diff":           diff,
            "tax_diff_label":     "Extra tax payable" if diff > 0 else "Refund due",
            "steps": [
                "1. Collect Form 16 Part A + Part B from BOTH employers",
                "2. Add both gross salaries -> use as 'Gross Salary' in ITR",
                "3. Standard Deduction (₹50K/₹75K) is given only ONCE in ITR — usually employer 2 omits it",
                "4. Add TDS from both Form 16 Part A in the 'Tax Details' tab of ITR",
                "5. If combined tax > total TDS paid: pay self-assessment tax before filing",
                "6. If total TDS > combined tax: you'll get a refund",
            ],
            "portal": "https://www.incometax.gov.in",
            **{k: v for k, v in combined_result.items() if k != "gross_salary"},
        }
    elif action == "download_guide":
        res = {
            "action":  "download_guide",
            "title":   "How to Download Form 16 from TRACES",
            "for_employee": [
                "1. Ask your employer's HR/Finance team to download your Form 16 Part A from TRACES",
                "2. TRACES: https://www.tdscpc.gov.in — only employers (with TAN) can log in",
                "3. Employer credentials: TAN login -> Form 16 -> Enter your PAN -> Download PDF",
                "4. The downloaded PDF has a unique certificate number — verify this is TRACES-generated (not just printed)",
                "5. Open it with 'TRACES PDF Converter' tool (free, from TRACES website) if it requires a password",
            ],
            "for_employer": [
                "Login to TRACES (TAN) -> Statements/Payments -> Form 16 -> Annual Year -> Employee PAN -> Download",
                "Use bulk download for multiple employees",
                "Must be issued to employees by June 15 every year",
            ],
            "employee_self": [
                "You CANNOT directly download Form 16 from IT portal as an employee",
                "However, verify TDS via: IT portal -> e-File -> View Form 26AS",
                "Also check: IT portal -> AIS (Annual Information Statement) for all TDS entries",
            ],
            "password_format": "TRACES PDF password = PAN in CAPITALS + Date of Birth in DDMMYYYY (e.g., ABCDE1234F01011985)",
        }
    elif action == "hra_exempt":
        basic       = float(payload.get("basic_salary", 0))
        hra_recv    = float(payload.get("hra_received", 0))
        rent        = float(payload.get("rent_paid", 0))
        city        = str(payload.get("city_type", "metro")).lower()
        if not basic or not hra_recv or not rent:
            res = {"error": "Provide basic_salary, hra_received, rent_paid, and city_type (metro/non-metro)"}
        else:
            rule1  = hra_recv
            rule2  = max(rent - 0.10 * basic, 0)
            pct    = 0.50 if city == "metro" else 0.40
            rule3  = pct * basic
            exempt = round(min(rule1, rule2, rule3), 2)
            res = {
                "action":           "hra_exempt",
                "rule1_hra_recvd":  round(rule1, 2),
                "rule2_rent_minus_10pct_basic": round(rule2, 2),
                "rule3_pct_basic":  round(rule3, 2),
                "city_percentage":  f"{int(pct*100)}%",
                "hra_exempt":       exempt,
                "hra_taxable":      round(hra_recv - exempt, 2),
                "note":             "Least of the three rules applies. Claim proofs: rent receipts + landlord PAN (if > ₹1L/year).",
            }
    elif action == "query":
        text = str(payload.get("text") or payload.get("question") or payload.get("q") or "")
        res = {
            "action":   "query",
            "question": text,
            "answer":   handle_query(text),
        }
    else:
        res = {
            "error":    f"Unknown action: {action}",
            "valid_actions": [
                "explain", "tax_calc", "section_guide", "checklist",
                "filing_steps", "tds_mismatch", "two_employers",
                "download_guide", "hra_exempt", "query",
            ],
        }

    return jsonify({
        "status": "ok",
        "agent": "Form 16 Agent",
        "message_id": message_id,
        "response": json.dumps(res)
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=port, threaded=True)
