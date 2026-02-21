export interface SchemeRule {
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
  ministry?: string;
  official_url?: string;
}

export interface RankedScheme extends EligibleScheme {
  rank: number;
  relevance_score: number;
}
