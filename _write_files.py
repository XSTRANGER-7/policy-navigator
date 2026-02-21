"""Helper: write frontend type definitions and updated components."""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

files = {}

# ── Types ──────────────────────────────────────────────────────────────────────
files["web/types/scheme.ts"] = """export interface SchemeRule {
  categories: string[];
  income_max: number;
  age_min: number;
  age_max: number;
}

export interface EligibleScheme {
  scheme_id: string;
  name: string;
  category: string;
  eligible: boolean;
  match_score: number;
  reasons_pass: string[];
  reasons_fail: string[];
  description: string;
  benefits: string;
  eligibility_text: string;
}

export interface RankedScheme extends EligibleScheme {
  rank: number;
  relevance_score: number;
}
"""

files["web/types/citizen.ts"] = """import type { RankedScheme } from "./scheme";

export interface CitizenProfile {
  email?: string;
  age: number;
  income: number;
  state?: string;
  category?: string;
}

export interface PipelineStep {
  step: string;
  count?: number;
  ok: boolean;
}

export interface AgentPipelineResponse {
  status: string;
  citizen_profile: CitizenProfile;
  eligible_schemes: RankedScheme[];
  ranked_schemes: RankedScheme[];
  vc: unknown | null;
  summary: string;
  total_eligible: number;
  pipeline: PipelineStep[];
  agent_id: string;
}
"""

files["web/types/credential.ts"] = """export interface VCSchemeRef {
  id: string;
  name: string;
  benefits: string;
  rank: number;
  score: number;
}

export interface VerifiableCredential {
  "@context": string[];
  type: string[];
  id: string;
  issuer: { id: string; name: string };
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    profile: {
      age: number;
      state: string;
      category: string;
      income_bracket: string;
    };
    eligibility: {
      verified: boolean;
      totalSchemes: number;
      schemes: VCSchemeRef[];
    };
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
  };
}
"""

# ── Write all files ────────────────────────────────────────────────────────────
for rel, content in files.items():
    path = os.path.join(ROOT, rel.replace("/", os.sep))
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.lstrip("\n"))
    print(f"  OK  {rel}")

print("All done.")
