import type { RankedScheme } from "./scheme";
import type { VerifiableCredential } from "./credential";

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
  partial_matches: boolean;
  vc: VerifiableCredential | null;
  summary: string;
  total_eligible: number;
  pipeline: PipelineStep[];
  agent_id: string;
}

export type ApplicationStatus =
  | "started"
  | "documents_submitted"
  | "under_review"
  | "approved"
  | "rejected";

export interface Application {
  id: string;
  scheme_id: string;
  scheme_name: string;
  status: ApplicationStatus;
  required_docs: string[];
  next_steps: string[];
  saved_to_db: boolean;
  message: string;
  application_id: string;
}

export interface UserProfile {
  id: string;
  role: "citizen" | "agency";
  full_name?: string;
  email?: string;
}
