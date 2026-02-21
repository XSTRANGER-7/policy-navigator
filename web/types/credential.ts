export interface VCSchemeRef {
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
