/**
 * eligibilityFallback.ts
 * ======================
 * Full TypeScript port of the Python eligibility pipeline.
 * Used as an inline fallback inside /api/agent when the Railway
 * Python agents are unreachable, so the Vercel frontend always
 * returns results instead of a 502.
 *
 * Logic mirrors:
 *   agents/policy-agent/agent.py     (SCHEMES_FALLBACK)
 *   agents/eligibility-agent/agent.py (check_scheme_eligibility)
 *   agents/matcher-agent/agent.py     (compute_relevance + ranking)
 *   agents/citizen-agent/agent.py     (orchestrator / pipeline glue)
 */

import type { RankedScheme } from "@/types/scheme";
import type { AgentPipelineResponse, CitizenProfile } from "@/types/citizen";

// ─── 1. Scheme Database ───────────────────────────────────────────────────────

interface SchemeRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  benefits: string;
  eligibility_text: string;
  rules: { categories: string[]; income_max: number; age_min: number; age_max: number };
  ministry: string;
  official_url: string;
}

const SCHEMES: SchemeRecord[] = [
  {
    id: "pm_kisan", name: "PM-KISAN", category: "farmer",
    description: "Direct income support of Rs.6,000/year to small and marginal farmer families.",
    benefits: "Rs.6,000/year in 3 equal installments of Rs.2,000",
    eligibility_text: "Land-owning farmer families with cultivable land.",
    rules: { categories: ["farmer"], income_max: 200000, age_min: 18, age_max: 70 },
    ministry: "Ministry of Agriculture and Farmers Welfare", official_url: "https://pmkisan.gov.in",
  },
  {
    id: "ayushman_bharat", name: "Ayushman Bharat (PM-JAY)", category: "health",
    description: "Health insurance cover of Rs.5 lakh per family per year for hospitalization.",
    benefits: "Rs.5 lakh/year health insurance cover",
    eligibility_text: "BPL and low-income families.",
    rules: { categories: ["bpl", "general", "sc_st", "obc", "farmer", "disabled", "women"], income_max: 300000, age_min: 0, age_max: 120 },
    ministry: "Ministry of Health and Family Welfare", official_url: "https://pmjay.gov.in",
  },
  {
    id: "pm_ujjwala", name: "PM Ujjwala Yojana", category: "women",
    description: "Free LPG connections to women from BPL households for clean cooking fuel.",
    benefits: "Free LPG connection + first refill cylinder",
    eligibility_text: "Women from BPL households without existing LPG connection.",
    rules: { categories: ["women", "bpl"], income_max: 200000, age_min: 18, age_max: 60 },
    ministry: "Ministry of Petroleum and Natural Gas", official_url: "https://pmuy.gov.in",
  },
  {
    id: "post_matric_scholarship", name: "Post Matric Scholarship (SC/ST/OBC)", category: "student",
    description: "Financial assistance for SC/ST/OBC students in post-matriculation education.",
    benefits: "Tuition fee reimbursement + monthly maintenance allowance",
    eligibility_text: "SC/ST/OBC students with family income below Rs.2.5 lakh/year.",
    rules: { categories: ["student", "sc_st", "obc"], income_max: 250000, age_min: 15, age_max: 30 },
    ministry: "Ministry of Social Justice and Empowerment", official_url: "https://scholarships.gov.in",
  },
  {
    id: "youth_scholarship", name: "Youth Scholarship Scheme", category: "student",
    description: "Merit-cum-means scholarship for economically weaker students.",
    benefits: "Rs.12,000/year scholarship stipend",
    eligibility_text: "Young students with annual family income below Rs.5 lakh.",
    rules: { categories: ["student", "general", "obc", "sc_st", "bpl"], income_max: 500000, age_min: 16, age_max: 30 },
    ministry: "Ministry of Education", official_url: "https://scholarships.gov.in",
  },
  {
    id: "mnrega", name: "MNREGA", category: "general",
    description: "Guaranteed 100 days of wage employment per year to rural household adults.",
    benefits: "100 days guaranteed employment at minimum wage",
    eligibility_text: "Any adult member of a rural household.",
    rules: { categories: ["general", "farmer", "bpl", "sc_st", "obc", "women", "disabled"], income_max: 300000, age_min: 18, age_max: 80 },
    ministry: "Ministry of Rural Development", official_url: "https://nrega.nic.in",
  },
  {
    id: "mudra_loan", name: "MUDRA Loan (PM Mudra Yojana)", category: "general",
    description: "Collateral-free loans Rs.50,000 to Rs.10 lakh for small businesses.",
    benefits: "Loans up to Rs.10 lakh at subsidized interest rates",
    eligibility_text: "Any Indian citizen with a non-farm business plan.",
    rules: { categories: ["general", "obc", "sc_st", "women", "farmer"], income_max: 1500000, age_min: 18, age_max: 65 },
    ministry: "Ministry of Finance", official_url: "https://mudra.org.in",
  },
  {
    id: "disability_pension", name: "Indira Gandhi National Disability Pension", category: "disabled",
    description: "Monthly pension for persons with severe disabilities living below poverty line.",
    benefits: "Rs.300–500/month pension",
    eligibility_text: "BPL persons with 80%+ disability, aged 18–79.",
    rules: { categories: ["disabled", "bpl"], income_max: 150000, age_min: 18, age_max: 79 },
    ministry: "Ministry of Rural Development", official_url: "https://nsap.nic.in",
  },
  {
    id: "senior_pension", name: "Indira Gandhi Old Age Pension", category: "senior_citizen",
    description: "Monthly pension for destitute elderly persons aged 60 and above.",
    benefits: "Rs.200–500/month depending on age",
    eligibility_text: "BPL individuals aged 60 years and above.",
    rules: { categories: ["senior_citizen", "bpl", "general"], income_max: 150000, age_min: 60, age_max: 120 },
    ministry: "Ministry of Rural Development", official_url: "https://nsap.nic.in",
  },
  {
    id: "pm_awas_gramin", name: "PM Awas Yojana (Gramin)", category: "bpl",
    description: "Financial assistance for construction of pucca houses for rural BPL families.",
    benefits: "Rs.1.2–1.5 lakh financial assistance for house construction",
    eligibility_text: "Homeless or kutcha-house BPL families in rural areas.",
    rules: { categories: ["bpl", "sc_st", "general", "farmer"], income_max: 200000, age_min: 18, age_max: 80 },
    ministry: "Ministry of Rural Development", official_url: "https://pmayg.nic.in",
  },
  {
    id: "standup_india", name: "Stand-Up India", category: "women",
    description: "Bank loans Rs.10 lakh to Rs.1 crore for SC/ST and women entrepreneurs.",
    benefits: "Loans Rs.10 lakh – Rs.1 crore for greenfield enterprises",
    eligibility_text: "SC/ST or women entrepreneurs above 18 years.",
    rules: { categories: ["women", "sc_st"], income_max: 5000000, age_min: 18, age_max: 65 },
    ministry: "Ministry of Finance", official_url: "https://standupmitra.in",
  },
  {
    id: "nps", name: "National Pension Scheme (NPS)", category: "general",
    description: "Contributory pension system for organized and unorganized sector workers.",
    benefits: "Market-linked pension corpus + tax benefits",
    eligibility_text: "Indian citizen aged 18–70 years.",
    rules: { categories: ["general", "farmer", "women", "obc", "sc_st"], income_max: 10000000, age_min: 18, age_max: 70 },
    ministry: "Ministry of Finance / PFRDA", official_url: "https://npscra.nsdl.co.in",
  },
  {
    id: "pm_fasal_bima", name: "PM Fasal Bima Yojana", category: "farmer",
    description: "Crop insurance scheme providing financial support to farmers suffering crop loss.",
    benefits: "Insurance cover for crop loss due to natural calamities",
    eligibility_text: "All farmers growing notified crops in notified areas.",
    rules: { categories: ["farmer"], income_max: 500000, age_min: 18, age_max: 70 },
    ministry: "Ministry of Agriculture", official_url: "https://pmfby.gov.in",
  },
  {
    id: "sukanya_samriddhi", name: "Sukanya Samriddhi Yojana", category: "women",
    description: "Savings scheme for girl child education and marriage expenses.",
    benefits: "High-interest savings account + tax exemption",
    eligibility_text: "Girl child under 10 years of age and her guardian.",
    rules: { categories: ["women", "general", "bpl", "sc_st", "obc"], income_max: 5000000, age_min: 0, age_max: 50 },
    ministry: "Ministry of Finance", official_url: "https://www.nsiindia.gov.in",
  },
  {
    id: "kisan_credit_card", name: "Kisan Credit Card (KCC)", category: "farmer",
    description: "Flexible credit for farmers to meet agriculture and consumption needs.",
    benefits: "Revolving credit up to Rs.3 lakh at 4% interest",
    eligibility_text: "Farmers, tenant farmers, oral lessees and sharecroppers.",
    rules: { categories: ["farmer"], income_max: 1000000, age_min: 18, age_max: 75 },
    ministry: "Ministry of Agriculture", official_url: "https://www.nabard.org",
  },
];

// ─── 2. Eligibility Rule Engine ───────────────────────────────────────────────

function checkEligibility(citizen: CitizenProfile, scheme: SchemeRecord): RankedScheme {
  const { rules } = scheme;
  const age      = Number(citizen.age  ?? 0);
  const income   = Number(citizen.income ?? 0);
  const category = String(citizen.category ?? "general").toLowerCase();

  const reasons_pass: string[] = [];
  const reasons_fail: string[] = [];

  // Category check
  const allowed = rules.categories.map((c) => c.toLowerCase());
  if (allowed.includes(category) || allowed.includes("general")) {
    reasons_pass.push(`Category '${category}' matches scheme`);
  } else {
    reasons_fail.push(`Category '${category}' not in [${allowed.join(", ")}]`);
  }

  // Age check
  if (age >= rules.age_min && age <= rules.age_max) {
    reasons_pass.push(`Age ${age} within allowed range ${rules.age_min}–${rules.age_max}`);
  } else {
    reasons_fail.push(`Age ${age} outside allowed range ${rules.age_min}–${rules.age_max}`);
  }

  // Income check
  if (income <= rules.income_max) {
    reasons_pass.push(`Income ₹${income.toLocaleString("en-IN")} within limit ₹${rules.income_max.toLocaleString("en-IN")}`);
  } else {
    reasons_fail.push(`Income ₹${income.toLocaleString("en-IN")} exceeds limit ₹${rules.income_max.toLocaleString("en-IN")}`);
  }

  const total      = reasons_pass.length + reasons_fail.length;
  const match_score = total > 0 ? Math.round((reasons_pass.length / total) * 100) : 0;
  const eligible   = reasons_fail.length === 0;

  return {
    scheme_id:       scheme.id,
    name:            scheme.name,
    category:        scheme.category,
    eligible,
    match_score,
    reasons_pass,
    reasons_fail,
    description:     scheme.description,
    benefits:        scheme.benefits,
    eligibility_text: scheme.eligibility_text,
    ministry:        scheme.ministry,
    official_url:    scheme.official_url,
    rank:            0,            // filled in by ranker
    relevance_score: match_score,  // overwritten by ranker
  };
}

// ─── 3. Relevance Ranker ──────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<string, number> = {
  bpl: 10, disabled: 9, sc_st: 8, senior_citizen: 8,
  women: 7, farmer: 7, student: 6, obc: 5, general: 3,
};

function computeRelevance(citizen: CitizenProfile, scheme: RankedScheme): number {
  const base     = scheme.match_score ?? 50;
  const category = String(citizen.category ?? "general").toLowerCase();
  const income   = Number(citizen.income ?? 0);

  const exactBoost = category === scheme.category.toLowerCase() ? 25 : (CATEGORY_WEIGHTS[category] ?? 0);
  const incomeBoost = income < 150000 ? 5 : income < 300000 ? 3 : 0;

  return Math.min(100, base + exactBoost + incomeBoost);
}

function rankSchemes(citizen: CitizenProfile, schemes: RankedScheme[]): RankedScheme[] {
  const scored = schemes.map((s) => ({
    ...s,
    relevance_score: computeRelevance(citizen, s),
  }));
  const sorted = scored.sort((a, b) => b.relevance_score - a.relevance_score);
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}

// ─── 4. Public Entry Point ────────────────────────────────────────────────────

/**
 * Run the full eligibility pipeline in-process (no network calls).
 * Returns the same shape as AgentPipelineResponse so the frontend
 * component doesn't need to know whether the result came from
 * Railway or this local fallback.
 */
export function runEligibilityFallback(citizen: CitizenProfile): AgentPipelineResponse {
  // Step 1 — evaluate all schemes
  const allEvaluated = SCHEMES.map((s) => checkEligibility(citizen, s));
  const eligible      = allEvaluated.filter((s) => s.eligible);
  const partial       = allEvaluated
    .filter((s) => !s.eligible)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  const usingPartial = eligible.length === 0;
  const toRank       = usingPartial ? partial.slice(0, 6) : eligible;

  // Step 2 — rank
  const ranked = rankSchemes(citizen, toRank);

  // Step 3 — summary
  const summary = usingPartial
    ? `No exact matches found. Showing ${ranked.length} nearest partial matches.`
    : eligible.length === 1
    ? "You are eligible for 1 government scheme."
    : `You are eligible for ${eligible.length} government schemes.`;

  return {
    status:           "ok",
    citizen_profile:  citizen,
    eligible_schemes: eligible,
    ranked_schemes:   ranked,
    partial_matches:  usingPartial,
    vc:               null,
    summary,
    total_eligible:   eligible.length,
    agent_id:         "ts-fallback",
    pipeline: [
      { step: "policy_fetch",       count: SCHEMES.length, ok: true },
      { step: "eligibility_check",  count: eligible.length, ok: true },
      { step: "scheme_ranking",     count: ranked.length, ok: true },
      { step: "vc_issuance",        count: 0, ok: false },
    ],
  };
}
