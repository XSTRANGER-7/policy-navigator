"use client";

import { useState, useCallback } from "react";

// ─── Static knowledge (mirrors agent KB) ─────────────────────────────────────
const FILING_STEPS = [
  {
    step: 1, icon: "📄", title: "Collect Documents",
    tasks: [
      "Form 16 Part A — ask employer to download from TRACES portal",
      "Form 16 Part B — salary breakup sheet from employer",
      "Form 26AS — verify all TDS entries match",
      "AIS (Annual Information Statement) — all income sources",
      "Investment proofs: LIC, PPF, ELSS, NPS, school fee receipts",
      "Home loan interest certificate (for Section 24b)",
      "Rent receipts + landlord PAN if HRA > ₹1 lakh/year",
      "Capital gains statement from broker (if applicable)",
    ],
  },
  {
    step: 2, icon: "✅", title: "Verify Form 26AS & AIS",
    tasks: [
      "Visit https://www.incometax.gov.in → login → View Form 26AS",
      "Check EVERY TDS entry matches your Form 16 Part A quarter-wise",
      "Also check AIS for bank interest, dividends, other income",
      "If mismatch found → contact HR immediately before filing",
    ],
  },
  {
    step: 3, icon: "📋", title: "Choose ITR Form",
    tasks: [
      "ITR-1 (SAHAJ) — salary + one house + other income ≤ ₹50L → simplest",
      "ITR-2 — capital gains, foreign income, multiple properties",
      "ITR-3 — business/profession + salary",
      "Most salaried employees use ITR-1",
    ],
  },
  {
    step: 4, icon: "⚖️", title: "Choose Tax Regime",
    tasks: [
      "New Regime (default FY 24-25): standard deduction ₹75K, lower slabs, minimal deductions",
      "Old Regime: higher slabs but 80C, 80D, HRA, 24b all allowed",
      "Use the Tax Calculator tab to compare both regimes",
      "Regime change allowed only at start of new FY",
    ],
  },
  {
    step: 5, icon: "🖥️", title: "File on IT Portal",
    tasks: [
      "Visit https://www.incometax.gov.in → e-File → Income Tax Return → File ITR",
      "Select AY 2025-26 for FY 2024-25",
      "Use Online mode — most data is pre-filled from Form 26AS",
      "Add salary details from Form 16 Part B",
      "Enter deductions under Chapter VI-A tab",
      "Confirm tax payable or refund amount",
    ],
  },
  {
    step: 6, icon: "🔏", title: "e-Verify Your Return",
    tasks: [
      "Aadhaar OTP (fastest & recommended)",
      "Net Banking, Demat account, Bank ATM EVC",
      "OR post signed ITR-V to CPC Bengaluru within 30 days",
      "Return is not valid until verified — do not skip this step",
    ],
  },
  {
    step: 7, icon: "💰", title: "Track Refund",
    tasks: [
      "Login → e-File → View Filed Returns → check processing status",
      "Refund credited within 20-45 days after e-verification",
      "Track on NSDL: https://tin.tin.nsdl.com/oltas/refundstatuslogin.html",
      "Intimation u/s 143(1) arrives on registered email",
    ],
  },
];

const CHECKLIST_ITEMS = [
  { item: "Form 16 Part A",              done: false, note: "TRACES-generated — request from employer" },
  { item: "Form 16 Part B",              done: false, note: "Salary breakup from employer / HR" },
  { item: "Form 26AS",                   done: false, note: "IT portal → View Form 26AS" },
  { item: "AIS / TIS",                   done: false, note: "IT portal → Services → Annual Information Statement" },
  { item: "PAN Card",                    done: false, note: "Must be linked to Aadhaar" },
  { item: "Bank Account (pre-validated)",done: false, note: "IT portal → My Profile → Bank Account" },
  { item: "80C Investment Proofs",       done: false, note: "LIC, PPF, ELSS, NPS, school fees" },
  { item: "Health Insurance Receipt (80D)", done: false, note: "From insurer — premium certificate" },
  { item: "Home Loan Interest Cert.",    done: false, note: "From bank — Section 24(b)" },
  { item: "Rent Receipts + Landlord PAN", done: false, note: "If HRA claim > ₹1 lakh/year" },
  { item: "NPS Statement",               done: false, note: "NSDL CRA — for 80CCD(1B)" },
  { item: "Capital Gains Statement",     done: false, note: "Broker tax P&L (Zerodha / Groww etc.)" },
];

const FAQS = [
  {
    q: "What is Form 16 and why do I need it?",
    a: "Form 16 is a TDS certificate issued by your employer every year (by June 15). It has two parts — Part A (TDS deducted, downloaded from TRACES) and Part B (salary breakup, employer-prepared). It's the primary document for filing your ITR as a salaried employee.",
  },
  {
    q: "What's the difference between Part A and Part B?",
    a: "Part A is generated directly from the government's TRACES portal — shows TAN, PAN, and quarter-wise TDS deposited. Part B is prepared by your employer — shows your gross salary, exemptions (HRA, LTA), deductions (80C, 80D), and final taxable income. Both together form a complete Form 16.",
  },
  {
    q: "How do I download Form 16 from TRACES?",
    a: "As an employee, you cannot log in to TRACES directly. Ask your HR / Finance team to download it for you. Employers log in with their TAN at https://www.tdscpc.gov.in → Statements → Form 16. The password to open the PDF is: PAN (uppercase) + Date of Birth DDMMYYYY (e.g., ABCDE1234F01011985).",
  },
  {
    q: "I worked for two companies this year — how do I handle two Form 16s?",
    a: "Add both gross salaries together. Both TDS amounts go in the 'Tax Details' tab. Standard deduction (₹75K) is given only ONCE in the final ITR. Use our calculator for the combined salary. If combined tax > total TDS paid, pay the difference as self-assessment tax before filing.",
  },
  {
    q: "My Form 16 TDS doesn't match my Form 26AS — what do I do?",
    a: "Do NOT file ITR yet. Contact your employer's HR/Finance immediately. They need to revise their 24Q TDS return to fix the mismatch. The IT department uses Form 26AS (not Form 16) during processing — a mismatch will generate a demand notice. Only file after the mismatch is resolved.",
  },
  {
    q: "New regime vs Old regime — which is better?",
    a: "Use the Tax Calculator tab to compare both instantly. As a thumb rule: if your deductions (80C + 80D + HRA + 24b) are > ₹3.75 lakh/year, old regime usually saves more tax. Below that, new regime is simpler and often cheaper. For income ≤ ₹7 lakh in new regime, tax is ZERO due to Sec 87A rebate.",
  },
  {
    q: "What is Section 87A rebate?",
    a: "New regime: if your taxable income is ≤ ₹7,00,000 — your entire tax liability is waived. Old regime: if taxable income ≤ ₹5,00,000, rebate of up to ₹12,500 applies. This means zero tax for most middle-income earners under the new regime.",
  },
  {
    q: "I received salary arrears — do I pay tax on that?",
    a: "Yes, but you can claim Section 89 relief to avoid double taxation. IMPORTANT: File Form 10E ONLINE on the income tax portal BEFORE filing your ITR. Without 10E, the relief is denied automatically. Go to: IT portal → e-File → Income Tax Forms → Form 10E.",
  },
  {
    q: "What is the ITR filing deadline?",
    a: "For salaried employees (no audit): July 31, 2025 for AY 2025-26 (FY 2024-25). Belated returns can be filed by December 31 with a ₹5,000 penalty. Interest under Section 234A (1%/month) also applies on outstanding tax if filed late.",
  },
];

const SECTIONS = [
  { id: "80c",  label: "80C",      title: "80C — Tax-saving Investments",           limit: "₹1,50,000",  color: "bg-blue-50 border-blue-300", items: ["EPF (employee contribution)","PPF","LIC Life Insurance premiums","ELSS Mutual Funds (3-yr lock-in)","NSC","Home Loan Principal","Children's Tuition Fees","5-Year Bank FD","Sukanya Samriddhi Yojana"] },
  { id: "80d",  label: "80D",      title: "80D — Health Insurance",                  limit: "₹25K–₹75K", color: "bg-red-50 border-red-300",  items: ["Self + family health insurance: ₹25,000","Parents (< 60 yrs): ₹25,000","Senior citizen parents: ₹50,000","Preventive health check-up: ₹5,000 (within 80D limit)"] },
  { id: "hra",  label: "HRA",      title: "HRA — House Rent Allowance Exemption",    limit: "Least of 3", color: "bg-green-50 border-green-300",items: ["Rule 1: Actual HRA received","Rule 2: Rent paid − 10% of Basic Salary","Rule 3: 50% of Basic (metro) / 40% of Basic (non-metro)","Exemption = Minimum of all 3 rules"] },
  { id: "80ccd",label: "80CCD(1B)", title: "80CCD(1B) — NPS Additional Deduction",   limit: "₹50,000 extra", color: "bg-purple-50 border-purple-300", items: ["NPS Tier 1 voluntary contributions","OVER and ABOVE the ₹1.5L 80C limit","Old regime only — not available in new regime","Saves up to ₹15,000 extra (30% bracket)"] },
  { id: "24b",  label: "24(b)",    title: "Section 24(b) — Home Loan Interest",      limit: "₹2,00,000",  color: "bg-yellow-50 border-yellow-300", items: ["Self-occupied property: max ₹2 lakh/year","Let-out property: actual interest paid","Pre-construction interest: 5 equal yearly installments","Get interest certificate from bank every year"] },
  { id: "87a",  label: "87A",      title: "Section 87A — Tax Rebate",               limit: "Full rebate ≤ ₹7L", color: "bg-lime-50 border-lime-300", items: ["New regime: zero tax if taxable income ≤ ₹7,00,000","Old regime: rebate up to ₹12,500 if income ≤ ₹5,00,000","Rebate is applied BEFORE 4% cess","Effective net-zero tax for most new-regime filers below ₹7L"] },
];

// ─── Tax Calculator ───────────────────────────────────────────────────────────
interface TaxResult {
  gross_salary: number;
  total_deductions: number;
  hra_exempt: number;
  taxable_income: number;
  tax_before_cess: number;
  rebate_87a: number;
  tax_after_rebate: number;
  cess_4pct: number;
  total_tax_payable: number;
  monthly_tds: number;
  effective_rate_pct: number;
  regime: string;
  error?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = "overview" | "calculator" | "guide" | "checklist" | "faq" | "premium";

export default function Form16Page() {
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: { id: Tab; label: string; icon: string; highlight?: boolean }[] = [
    { id: "overview",   label: "Overview",       icon: "📄" },
    { id: "calculator", label: "Tax Calculator", icon: "🧮" },
    { id: "guide",      label: "Filing Steps",   icon: "🗺️" },
    { id: "checklist",  label: "Checklist",      icon: "✅" },
    { id: "faq",        label: "FAQ",             icon: "💬" },
    { id: "premium",    label: "Premium Reports", icon: "💳", highlight: true },
  ];

  return (
    <section className="px-4 md:px-8 py-10 max-w-6xl mx-auto">

      {/* ── Hero ── */}
      <div className="mb-10 relative overflow-hidden bg-black border-4 border-black rounded-3xl p-8 md:p-14 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage:"linear-gradient(rgba(217,255,0,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(217,255,0,0.3) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end gap-8 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#d9ff00] rounded-full px-4 py-1.5 font-black text-[10px] uppercase mb-5">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
              FORM 16 ASSISTANT · AI POWERED
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white leading-[0.9] mb-3">
              FORM 16<br />
              <span className="text-[#d9ff00]">MADE EASY.</span>
            </h1>
            <p className="text-white/60 font-bold text-lg max-w-xl">
              Understand your Form 16, calculate exact tax liability, compare regimes, and file ITR — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { v: "7", label: "Filing Steps" },
              { v: "8", label: "Tax Sections" },
              { v: "12", label: "FAQ Topics"  },
            ].map(({ v, label }) => (
              <div key={label} className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-center min-w-[80px]">
                <p className="text-[#d9ff00] font-black text-2xl">{v}</p>
                <p className="text-white/50 text-[10px] font-black uppercase">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-2.5 border-[3px] border-black rounded-full font-black text-xs uppercase transition-all ${
              tab === t.id
                ? "bg-black text-[#d9ff00] shadow-[3px_3px_0px_0px_rgba(0,0,0,0.4)]"
                : t.highlight
                ? "bg-[#d9ff00] hover:bg-black hover:text-[#d9ff00] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
                : "bg-white hover:bg-[#d9ff00] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5"
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === "overview"   && <OverviewTab />}
      {tab === "calculator" && <CalculatorTab />}
      {tab === "guide"      && <GuideTab />}
      {tab === "checklist"  && <ChecklistTab />}
      {tab === "faq"        && <FaqTab />}
      {tab === "premium"    && <PremiumTab />}

    </section>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Quick cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-3xl mb-3">📂</div>
          <h2 className="font-black text-xl uppercase mb-2">What is Form 16?</h2>
          <p className="font-bold text-black/70 text-sm leading-relaxed">
            A TDS certificate issued by your employer under Section 203 of the Income Tax Act. Covers the salary, TDS deducted, and deductions for the full financial year. Issued every year by <strong>June 15</strong>.
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-[10px] bg-black text-[#d9ff00] font-black px-3 py-1 rounded-full uppercase">Part A — TDS Summary</span>
            <span className="text-[10px] bg-black text-[#d9ff00] font-black px-3 py-1 rounded-full uppercase">Part B — Salary Breakup</span>
          </div>
        </div>
        <div className="bg-black text-white border-4 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.4)]">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="font-black text-xl uppercase text-[#d9ff00] mb-2">Common Mistakes</h2>
          <ul className="space-y-2 text-sm font-bold text-white/70">
            <li>✗ Filing ITR with Form 16 TDS ≠ Form 26AS</li>
            <li>✗ Forgetting to file Form 10E for arrears (Sec 89)</li>
            <li>✗ Claiming Standard Deduction twice (two employers)</li>
            <li>✗ Not pre-validating bank account before filing</li>
            <li>✗ Skipping e-Verification after filing</li>
          </ul>
        </div>
      </div>

      {/* Part A vs Part B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          {
            part: "Part A", color: "border-blue-400 bg-blue-50",
            badge: "bg-blue-500",
            source: "Downloaded from TRACES portal by employer",
            items: ["Employer TAN + employee PAN","Quarter-wise TDS deducted & deposited","TDS certificate number (27A)","Must be TRACES-generated — verify certificate number"],
          },
          {
            part: "Part B", color: "border-green-400 bg-green-50",
            badge: "bg-green-600",
            source: "Prepared by employer (Excel / PDF)",
            items: ["Gross salary breakdown (basic, HRA, allowances)","Less: Section 10 exemptions (HRA, LTA, gratuity)","Standard Deduction reducing 50,000/75,000","Chapter VI-A deductions (80C, 80D, NPS…)","Net taxable income & total TDS"],
          },
        ].map(({ part, color, badge, source, items }) => (
          <div key={part} className={`border-4 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.7)] ${color}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-white text-[10px] font-black px-3 py-1 rounded-full uppercase ${badge}`}>{part}</span>
              <span className="text-[10px] font-bold text-black/50">{source}</span>
            </div>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item} className="flex gap-2 text-sm font-bold text-black/70">
                  <span className="text-black mt-0.5">→</span> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Section guide accordion */}
      <div>
        <h2 className="font-black text-2xl uppercase tracking-tight mb-4">Key Tax Sections Quick Guide</h2>
        <div className="space-y-2">
          {SECTIONS.map((s) => (
            <div key={s.id} className={`border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
              <button
                onClick={() => setOpenSection(openSection === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border-2 border-black ${s.color}`}>{s.label}</span>
                  <span className="font-black text-sm uppercase tracking-tight">{s.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black bg-[#d9ff00] border border-black px-3 py-0.5 rounded-full">Max: {s.limit}</span>
                  <span className="font-black text-black/40 text-lg">{openSection === s.id ? "−" : "+"}</span>
                </div>
              </button>
              {openSection === s.id && (
                <div className={`border-t-4 border-black p-5 ${s.color}`}>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {s.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm font-bold text-black/70">
                        <span className="text-green-600 flex-shrink-0">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tax Calculator Tab ───────────────────────────────────────────────────────
function CalculatorTab() {
  const [regime,          setRegime]          = useState<"new" | "old">("new");
  const [grossSalary,     setGrossSalary]     = useState("");
  const [basicSalary,     setBasicSalary]     = useState("");
  const [hraReceived,     setHraReceived]     = useState("");
  const [rentPaid,        setRentPaid]        = useState("");
  const [isMetro,         setIsMetro]         = useState(true);
  const [d80c,            setD80c]            = useState("");
  const [d80d,            setD80d]            = useState("");
  const [d80ccd,          setD80ccd]          = useState("");
  const [homeLoanInt,     setHomeLoanInt]     = useState("");
  const [profTax,         setProfTax]         = useState("");
  const [compareMode,     setCompareMode]     = useState(false);

  const [result,    setResult]    = useState<TaxResult | null>(null);
  const [resultOld, setResultOld] = useState<TaxResult | null>(null);
  const [loading,   setLoading]   = useState(false);

  const calculate = useCallback(async () => {
    setLoading(true);
    const base = {
      gross_salary:      Number(grossSalary) || 0,
      basic_salary:      Number(basicSalary) || 0,
      hra_received:      Number(hraReceived) || 0,
      rent_paid:         Number(rentPaid)    || 0,
      city_type:         isMetro ? "metro" : "non-metro",
      deduction_80c:     Number(d80c)        || 0,
      deduction_80d:     Number(d80d)        || 0,
      deduction_80ccd1b: Number(d80ccd)      || 0,
      home_loan_interest:Number(homeLoanInt) || 0,
      professional_tax:  Number(profTax)     || 0,
    };
    try {
      const [rNew, rOld] = await Promise.all([
        fetch("/api/form16", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...base, regime:"new", action:"tax_calc" }) }).then(r=>r.json()),
        fetch("/api/form16", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...base, regime:"old", action:"tax_calc" }) }).then(r=>r.json()),
      ]);
      setResult(rNew  as TaxResult);
      setResultOld(rOld as TaxResult);
    } catch {
      setResult({ error: "Calculation failed" } as unknown as TaxResult);
    }
    setLoading(false);
  }, [grossSalary, basicSalary, hraReceived, rentPaid, isMetro, d80c, d80d, d80ccd, homeLoanInt, profTax]);

  const displayed = regime === "new" ? result : resultOld;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Inputs */}
        <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <h2 className="font-black text-xl uppercase tracking-tight">Enter Salary Details</h2>

          {/* Regime toggle */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Tax Regime</p>
            <div className="flex gap-2">
              {(["new","old"] as const).map((r) => (
                <button key={r} onClick={() => setRegime(r)}
                  className={`flex-1 py-2 font-black text-xs uppercase border-[3px] border-black rounded-full transition-all ${regime === r ? "bg-black text-[#d9ff00]" : "hover:bg-[#d9ff00]"}`}>
                  {r === "new" ? "🆕 New (Default)" : "🏛 Old Regime"}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold text-black/40 mt-1">
              {regime === "new" ? "New: Std. ₹75K, no 80C/80D. Zero tax ≤ ₹7L income." : "Old: Std. ₹50K + all exemptions & Chapter VI-A deductions allowed."}
            </p>
          </div>

          {/* Fields */}
          {[
            { label:"Gross Annual Salary (₹)", val:grossSalary, set:setGrossSalary, placeholder:"e.g. 800000" },
            { label:"Basic Salary (₹) — if known", val:basicSalary, set:setBasicSalary, placeholder:"Usually 40-50% of gross" },
          ].map(({label,val,set,placeholder}) => (
            <div key={label}>
              <label className="block text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{label}</label>
              <input type="number" value={val} onChange={e=>set(e.target.value)}
                placeholder={placeholder}
                className="civis-input w-full rounded-lg text-sm" />
            </div>
          ))}

          {/* HRA */}
          <div className="border-t border-black/10 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">HRA (if applicable)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-black/40 mb-1">HRA Received (₹)</label>
                <input type="number" value={hraReceived} onChange={e=>setHraReceived(e.target.value)} placeholder="e.g. 180000" className="civis-input w-full rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-black/40 mb-1">Rent Paid (₹)</label>
                <input type="number" value={rentPaid} onChange={e=>setRentPaid(e.target.value)} placeholder="e.g. 240000" className="civis-input w-full rounded-lg text-xs" />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              {["metro","non-metro"].map((c) => (
                <button key={c} onClick={()=>setIsMetro(c==="metro")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase border-2 border-black rounded-full transition-colors ${isMetro===(c==="metro")?"bg-black text-[#d9ff00]":"hover:bg-[#d9ff00]"}`}>
                  {c==="metro"?"🏙 Metro (50%)":"🏘 Non-Metro (40%)"}
                </button>
              ))}
            </div>
          </div>

          {/* Old-regime deductions */}
          {regime === "old" && (
            <div className="border-t border-black/10 pt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">Old Regime Deductions</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:"80C (max ₹1.5L)", val:d80c, set:setD80c, ph:"e.g. 150000" },
                  { label:"80D Health Ins.", val:d80d, set:setD80d, ph:"e.g. 25000"  },
                  { label:"80CCD(1B) NPS",   val:d80ccd, set:setD80ccd, ph:"e.g. 50000" },
                  { label:"24(b) Home Loan", val:homeLoanInt, set:setHomeLoanInt, ph:"e.g. 200000" },
                ].map(({label,val,set,ph}) => (
                  <div key={label}>
                    <label className="block text-[10px] font-bold text-black/40 mb-1">{label}</label>
                    <input type="number" value={val} onChange={e=>set(e.target.value)} placeholder={ph} className="civis-input w-full rounded-lg text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Professional Tax (₹)</label>
            <input type="number" value={profTax} onChange={e=>setProfTax(e.target.value)} placeholder="e.g. 2400" className="civis-input w-full rounded-lg text-sm" />
          </div>

          <button onClick={calculate} disabled={!grossSalary || loading}
            className="w-full civis-btn rounded-full py-3 font-black uppercase text-sm disabled:opacity-50">
            {loading ? "Computing…" : "Calculate Tax →"}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {displayed && !displayed.error && (
            <>
              <div className="bg-black border-4 border-black rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.4)] text-white">
                <p className="text-[10px] font-black uppercase text-white/40 mb-1">
                  {displayed.regime === "new" ? "🆕 New Regime" : "🏛 Old Regime"} · FY 2024-25 (AY 2025-26)
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">Gross Salary</p>
                    <p className="font-black text-xl text-white">{fmt(displayed.gross_salary)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">Total Deductions</p>
                    <p className="font-black text-xl text-green-400">−{fmt(displayed.total_deductions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">Taxable Income</p>
                    <p className="font-black text-xl text-white">{fmt(displayed.taxable_income)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">Tax After Rebate</p>
                    <p className="font-black text-xl text-yellow-300">{fmt(displayed.tax_after_rebate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">4% Cess</p>
                    <p className="font-black text-lg text-white/70">+{fmt(displayed.cess_4pct)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white/40">Section 87A Rebate</p>
                    <p className="font-black text-lg text-green-400">−{fmt(displayed.rebate_87a)}</p>
                  </div>
                </div>
                <div className="mt-5 bg-[#d9ff00] text-black rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase">Total Annual Tax</p>
                    <p className="font-black text-3xl">{fmt(displayed.total_tax_payable)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase">Monthly TDS</p>
                    <p className="font-black text-2xl">{fmt(displayed.monthly_tds)}</p>
                    <p className="text-[9px] font-bold text-black/50">Effective Rate: {displayed.effective_rate_pct}%</p>
                  </div>
                </div>
              </div>

              {/* Comparison */}
              {result && resultOld && (
                <div className="bg-white border-4 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="font-black text-sm uppercase mb-3">🆚 Regime Comparison</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "🆕 New Regime", tax: result.total_tax_payable, rate: result.effective_rate_pct },
                      { label: "🏛 Old Regime", tax: resultOld.total_tax_payable, rate: resultOld.effective_rate_pct },
                    ].map(({ label, tax, rate }) => {
                      const isBetter = (label.includes("New") && result.total_tax_payable <= resultOld.total_tax_payable)
                                    || (label.includes("Old") && resultOld.total_tax_payable < result.total_tax_payable);
                      return (
                        <div key={label} className={`p-4 rounded-xl border-[3px] ${isBetter ? "border-green-500 bg-green-50" : "border-black/20 bg-zinc-50"}`}>
                          <p className="text-[10px] font-black uppercase text-black/40">{label}</p>
                          <p className={`font-black text-xl ${isBetter ? "text-green-700" : ""}`}>{fmt(tax)}</p>
                          <p className="text-[10px] font-bold text-black/40">{rate}% effective</p>
                          {isBetter && <span className="text-[8px] bg-green-500 text-white font-black px-2 py-0.5 rounded-full uppercase">Better ✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  {result.total_tax_payable !== resultOld.total_tax_payable && (
                    <p className="mt-3 text-xs font-black text-center text-black/60">
                      {result.total_tax_payable < resultOld.total_tax_payable
                        ? `New regime saves ${fmt(resultOld.total_tax_payable - result.total_tax_payable)}`
                        : `Old regime saves ${fmt(result.total_tax_payable - resultOld.total_tax_payable)}`}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!displayed && !loading && (
            <div className="border-4 border-dashed border-black/20 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🧮</p>
              <p className="font-black uppercase text-black/30 text-sm">Enter salary details and hit Calculate</p>
              <p className="text-xs font-bold text-black/30 mt-1">Results will show both New and Old regime comparison</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="font-black uppercase text-sm text-black/40">Computing tax…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filing Guide Tab ─────────────────────────────────────────────────────────
function GuideTab() {
  const [open, setOpen] = useState<number | null>(1);
  return (
    <div className="space-y-3">
      <div className="bg-[#d9ff00] border-4 border-black rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4 justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <p className="font-black text-sm uppercase">📌 Deadline: July 31, 2025</p>
          <p className="text-xs font-bold text-black/60">For AY 2025-26 (FY 2024-25) — for salaried employees</p>
        </div>
        <div className="flex gap-2">
          <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-black uppercase bg-black text-[#d9ff00] px-4 py-2 rounded-full hover:opacity-80">
            IT Portal ↗
          </a>
        </div>
      </div>
      {FILING_STEPS.map((s) => (
        <div key={s.step} className="border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <button
            onClick={() => setOpen(open === s.step ? null : s.step)}
            className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-zinc-50 transition-colors"
          >
            <span className="w-10 h-10 bg-[#d9ff00] border-2 border-black rounded-full flex items-center justify-center font-black text-sm flex-shrink-0">
              {s.step}
            </span>
            <div className="flex-1 text-left">
              <p className="font-black text-sm uppercase tracking-tight">{s.icon} {s.title}</p>
              <p className="text-[10px] font-bold text-black/40">{s.tasks.length} action{s.tasks.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="font-black text-black/30 text-xl">{open === s.step ? "−" : "+"}</span>
          </button>
          {open === s.step && (
            <div className="border-t-4 border-black bg-zinc-50 px-5 py-4">
              <ul className="space-y-2">
                {s.tasks.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm font-bold text-black/70">
                    <span className="w-5 h-5 bg-black text-[#d9ff00] rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5">{i+1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Checklist Tab ────────────────────────────────────────────────────────────
function ChecklistTab() {
  const [items, setItems] = useState(CHECKLIST_ITEMS.map(i => ({ ...i })));
  const done = items.filter(i => i.done).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border-4 border-black rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-xl uppercase">ITR Filing Checklist</h2>
          <span className={`text-xs font-black px-3 py-1 rounded-full border-2 border-black ${done === items.length ? "bg-green-400" : "bg-[#d9ff00]"}`}>
            {done}/{items.length} Ready
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-3 bg-black/10 rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-[#d9ff00] border-r-2 border-black transition-all" style={{ width:`${(done/items.length)*100}%` }} />
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <label key={item.item} className={`flex items-start gap-3 p-3 border-[3px] rounded-xl cursor-pointer transition-colors ${item.done ? "border-green-400 bg-green-50" : "border-black hover:bg-zinc-50"}`}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => setItems(prev => prev.map((x, i) => i === idx ? { ...x, done: !x.done } : x))}
                className="w-5 h-5 accent-black mt-0.5 flex-shrink-0"
              />
              <div className="flex-1">
                <p className={`font-black text-sm ${item.done ? "line-through text-black/40" : ""}`}>{item.item}</p>
                <p className="text-[10px] font-bold text-black/40 mt-0.5">{item.note}</p>
              </div>
              {item.done && <span className="text-green-600 font-black text-lg flex-shrink-0">✓</span>}
            </label>
          ))}
        </div>
        {done === items.length && (
          <div className="mt-5 bg-green-400 border-4 border-black rounded-xl p-4 text-center">
            <p className="font-black uppercase text-lg">🎉 All Set! Ready to File ITR.</p>
            <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 bg-black text-[#d9ff00] font-black text-xs uppercase px-6 py-2 rounded-full hover:opacity-80">
              File Now on IT Portal ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Premium Reports Tab (x402 gated) ───────────────────────────────────────
const PREMIUM_FEATURES = [
  {
    id: "generate_report",
    icon: "📊",
    title: "Tax Computation Report",
    subtitle: "New vs Old Regime PDF",
    price: "$0.10 USDC",
    priceNum: 0.10,
    color: "#d9ff00",
    description: "Full side-by-side tax breakdown for both regimes. Includes taxable income, deductions, 87A rebate, cess, monthly TDS, and the recommended regime with savings amount.",
    bullets: ["New vs Old regime comparison", "Monthly TDS breakdown", "Recommended regime + savings", "Export-ready structured data"],
    fields: [
      { key: "gross_salary",       label: "Gross Salary (₹)",              type: "number", required: true },
      { key: "basic_salary",       label: "Basic Salary (₹)",              type: "number" },
      { key: "deduction_80c",      label: "80C Investment (₹, old only)",  type: "number" },
      { key: "deduction_80d",      label: "80D Health Insurance (₹)",      type: "number" },
      { key: "home_loan_interest", label: "Home Loan Interest (₹, 24b)",   type: "number" },
    ],
  },
  {
    id: "itr_prefill",
    icon: "📝",
    title: "ITR-1 Pre-fill Draft",
    subtitle: "Auto-populated form fields",
    price: "$0.25 USDC",
    priceNum: 0.25,
    color: "#c4f0ff",
    description: "Auto-generates all ITR-1 (SAHAJ) schedule values from your salary inputs. Copy the output directly into the Income Tax portal — Schedule S, Chapter VI-A, Part B-TTI.",
    bullets: ["Schedule S (salary)", "Chapter VI-A deductions", "Part B-TTI tax computation", "Self-assessment / refund amount"],
    fields: [
      { key: "gross_salary",       label: "Gross Salary (₹)",              type: "number", required: true },
      { key: "regime",             label: "Tax Regime",                    type: "select", options: ["new", "old"] },
      { key: "deduction_80c",      label: "80C Investment (₹)",            type: "number" },
      { key: "deduction_80d",      label: "80D Premium (₹)",               type: "number" },
      { key: "tds_deducted",       label: "Total TDS Deducted by Employer (₹)", type: "number" },
    ],
  },
  {
    id: "tds_reconcile",
    icon: "🔍",
    title: "TDS Reconciliation",
    subtitle: "Form 16 vs Form 26AS analysis",
    price: "$0.15 USDC",
    priceNum: 0.15,
    color: "#ffd6e7",
    description: "Quarter-wise TDS comparison between your Form 16 Part A and Form 26AS. Flags exact mismatches, identifies which quarters differ, and tells you exactly what to ask HR to fix.",
    bullets: ["Quarter-wise TDS comparison", "Exact mismatch amount per quarter", "Action items for HR / CA", "Safe-to-file verdict"],
    fields: [
      { key: "form16_tds_total",   label: "Form 16 Total TDS (₹)",         type: "number", required: true },
      { key: "traces_tds_total",   label: "Form 26AS Total TDS (₹)",        type: "number", required: true },
    ],
  },
];

type PremiumStep = "idle" | "paying" | "verifying" | "done" | "error";

function PremiumTab() {
  const [active, setActive]   = useState<string | null>(null);
  const [step,   setStep]     = useState<PremiumStep>("idle");
  const [fields, setFields]   = useState<Record<string, string>>({});
  const [txHash, setTxHash]   = useState("");
  const [result, setResult]   = useState<Record<string, unknown> | null>(null);
  const [errMsg, setErrMsg]   = useState("");
  const WALLET = "0xYourProjectWalletAddressHere"; // set PAYMENT_WALLET_ADDRESS in .env.local

  const feature = PREMIUM_FEATURES.find(f => f.id === active);

  function openFeature(id: string) {
    setActive(id); setStep("idle"); setFields({}); setTxHash(""); setResult(null); setErrMsg("");
  }
  function closeModal() {
    setActive(null); setStep("idle"); setResult(null); setErrMsg("");
  }

  async function handlePay() {
    if (!feature) return;
    if (!txHash.trim()) { setErrMsg("Enter a Base network transaction hash."); return; }
    setStep("verifying"); setErrMsg("");
    try {
      // Step 1: build x402 payment receipt from tx hash
      const payRes = await fetch("/api/form16/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: feature.id, tx_hash: txHash.trim() }),
      });
      const payData = await payRes.json() as Record<string, unknown>;
      if (!payRes.ok || !payData.x_payment_response) {
        setStep("error"); setErrMsg((payData.error as string) ?? "Payment verification failed."); return;
      }
      // Step 2: call premium agent with x402 payment receipt
      // ZyndAI x402 middleware on the premium agent verifies the receipt
      const params: Record<string, unknown> = {
        action: feature.id,
        x_payment_response: payData.x_payment_response,  // forwarded as X-PAYMENT-RESPONSE header
      };
      Object.entries(fields).forEach(([k, v]) => { if (v) params[k] = isNaN(Number(v)) ? v : Number(v); });
      const agentRes = await fetch("/api/form16/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const agentData = await agentRes.json() as Record<string, unknown>;
      if (!agentRes.ok) {
        setStep("error"); setErrMsg((agentData.error as string) ?? "Agent returned an error."); return;
      }
      setResult(agentData); setStep("done");
    } catch {
      setStep("error"); setErrMsg("Network error. Please try again.");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 bg-black border-4 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <p className="font-black text-[#d9ff00] uppercase text-sm tracking-widest mb-1">💳 x402 PAYMENT PROTOCOL · BASE NETWORK</p>
          <h2 className="text-white font-black text-2xl">Premium Reports</h2>
          <p className="text-white/50 text-xs font-bold mt-1">Pay micro-USDC on Base · ZyndAI native x402 middleware · Instant report delivery</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="bg-[#d9ff00] text-black font-black text-[10px] uppercase px-3 py-1 rounded-full">Powered by ZyndAI × x402</span>
          <span className="text-white/40 font-bold text-[10px]">Network: Base L2 · Asset: USDC</span>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {PREMIUM_FEATURES.map(feat => (
          <div key={feat.id} className="border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="p-5 flex-1" style={{ backgroundColor: feat.color }}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-4xl">{feat.icon}</span>
                <span className="bg-black text-white font-black text-xs px-3 py-1 rounded-full">{feat.price}</span>
              </div>
              <h3 className="font-black text-lg leading-tight mb-1">{feat.title}</h3>
              <p className="font-bold text-xs text-black/60 mb-3">{feat.subtitle}</p>
              <p className="text-sm font-bold text-black/70 leading-relaxed mb-4">{feat.description}</p>
              <ul className="space-y-1">
                {feat.bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-xs font-bold">
                    <span className="w-1.5 h-1.5 bg-black rounded-full flex-shrink-0" />{b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => openFeature(feat.id)}
              className="w-full border-t-4 border-black bg-black text-[#d9ff00] font-black text-sm uppercase py-3 hover:bg-zinc-900 transition-colors"
            >
              💳 Pay {feat.price} &amp; Get Report
            </button>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="border-4 border-black rounded-2xl p-6 bg-zinc-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <p className="font-black text-sm uppercase mb-4">🔗 How x402 Payment Works</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { n: "1", t: "Select Report",  d: "Choose a premium report and click Pay" },
            { n: "2", t: "Send USDC",       d: `Send the exact USDC amount to the wallet on Base network` },
            { n: "3", t: "Submit Tx Hash",  d: "Paste your Base network transaction hash" },
            { n: "4", t: "Get Report",      d: "Agent verifies payment & returns your report instantly" },
          ].map(({ n, t, d }) => (
            <div key={n} className="flex gap-3 items-start">
              <span className="bg-black text-[#d9ff00] font-black text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{n}</span>
              <div>
                <p className="font-black text-sm">{t}</p>
                <p className="text-xs text-black/50 font-bold">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-bold text-black/40">Wallet: <span className="font-black text-black/60">{WALLET}</span> · Protocol: x402 · Network: Base L2</p>
      </div>

      {/* Payment Modal */}
      {active && feature && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white border-4 border-black rounded-3xl p-8 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="text-3xl">{feature.icon}</span>
                <h3 className="font-black text-xl mt-1">{feature.title}</h3>
                <p className="text-black/50 text-xs font-bold">{feature.subtitle}</p>
              </div>
              <button onClick={closeModal} className="text-black/30 hover:text-black font-black text-2xl leading-none">✕</button>
            </div>

            {step === "done" && result ? (
              <div>
                <div className="bg-[#d9ff00] border-4 border-black rounded-xl p-4 mb-4">
                  <p className="font-black text-sm">✅ Payment Verified — Here&apos;s Your Report</p>
                </div>
                <pre className="bg-zinc-900 text-green-400 rounded-xl p-4 text-xs overflow-auto max-h-80 font-mono border-2 border-black">
                  {JSON.stringify(result, null, 2)}
                </pre>
                {/* Friendly summary for generate_report */}
                {Array.isArray(result.summary_lines) && (
                  <div className="mt-4 border-4 border-black rounded-xl p-4 bg-black text-white">
                    <p className="font-black text-xs uppercase text-[#d9ff00] mb-2">📊 Summary</p>
                    {(result.summary_lines as string[]).map((l, i) => (
                      <p key={i} className="font-mono text-xs text-white/80">{l}</p>
                    ))}
                    {!!result.recommended_regime && (
                      <p className="mt-2 font-black text-sm text-[#d9ff00]">👍 Recommended: {String(result.recommended_regime).toUpperCase()} regime · {String(result.saving_label ?? "")}</p>
                    )}
                  </div>
                )}
                <button onClick={closeModal} className="mt-4 w-full border-4 border-black bg-black text-[#d9ff00] font-black py-3 rounded-xl uppercase text-sm hover:bg-zinc-900">Close</button>
              </div>
            ) : step === "error" ? (
              <div>
                <div className="bg-red-100 border-4 border-red-500 rounded-xl p-4 mb-4">
                  <p className="font-black text-sm text-red-700">⚠️ Error</p>
                  <p className="text-sm font-bold text-red-600 mt-1">{errMsg}</p>
                </div>
                <button onClick={() => { setStep("paying"); setErrMsg(""); }} className="w-full border-4 border-black bg-black text-white font-black py-3 rounded-xl uppercase text-sm">Try Again</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Price callout */}
                <div className="border-4 border-black rounded-xl p-4" style={{ backgroundColor: feature.color }}>
                  <p className="font-black text-lg">{feature.price} <span className="font-bold text-sm text-black/50">on Base network</span></p>
                  <p className="text-xs font-bold text-black/60 mt-1">Send USDC to: <span className="font-black text-black">{WALLET}</span></p>
                </div>

                {/* Input fields */}
                {feature.fields.length > 0 && (
                  <div className="space-y-3">
                    <p className="font-black text-xs uppercase text-black/50">Your Data</p>
                    {feature.fields.map(f => (
                      <div key={f.key}>
                        <label className="block font-black text-xs mb-1">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
                        {f.type === "select" ? (
                          <select
                            value={fields[f.key] ?? ""}
                            onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                            className="w-full border-[3px] border-black rounded-lg px-3 py-2 font-bold text-sm"
                          >
                            <option value="">Select…</option>
                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={fields[f.key] ?? ""}
                            onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder="0"
                            className="w-full border-[3px] border-black rounded-lg px-3 py-2 font-bold text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tx hash input */}
                <div>
                  <label className="block font-black text-xs mb-1">Base Network Tx Hash <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={e => setTxHash(e.target.value)}
                    placeholder="0xabc123... (64 hex chars)"
                    className="w-full border-[3px] border-black rounded-lg px-3 py-2 font-mono text-xs"
                  />
                  <p className="text-[10px] font-bold text-black/40 mt-1">After sending USDC on Base, paste the transaction hash here</p>
                </div>

                {errMsg && <p className="text-red-600 font-bold text-xs">{errMsg}</p>}

                <button
                  onClick={handlePay}
                  disabled={step === "verifying"}
                  className="w-full border-4 border-black bg-black text-[#d9ff00] font-black py-3 rounded-xl uppercase text-sm hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === "verifying" ? "⏳ Verifying Payment…" : "✅ Verify Payment & Get Report"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FAQ Tab ──────────────────────────────────────────────────────────────────
function FaqTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      <div className="mb-6 bg-[#d9ff00] border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p className="font-black text-sm uppercase">💬 AI-Powered Answers</p>
        <p className="text-xs font-bold text-black/60 mt-0.5">These answers come from the Form 16 Agent knowledge base — covering TDS, deductions, ITR filing, and more.</p>
      </div>
      {FAQS.map((faq, i) => (
        <div key={i} className="border-4 border-black rounded-2xl overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-white hover:bg-zinc-50 text-left transition-colors"
          >
            <p className="font-black text-sm">{faq.q}</p>
            <span className="text-black/30 font-black text-xl flex-shrink-0">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <div className="border-t-4 border-black bg-zinc-50 px-5 py-4">
              <p className="text-sm font-bold text-black/70 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
