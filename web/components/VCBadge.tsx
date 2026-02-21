import type { VerifiableCredential } from "@/types/credential";

export default function VCBadge({ vc }: { vc: VerifiableCredential | null | undefined }) {
  if (!vc) return null;

  const subject = vc.credentialSubject;
  const elig = subject?.eligibility;
  const profile = subject?.profile;
  const issued = vc.issuanceDate ? new Date(vc.issuanceDate).toLocaleDateString() : "—";
  const expires = vc.expirationDate ? new Date(vc.expirationDate).toLocaleDateString() : "—";
  const did = subject?.id ?? "—";

  return (
    <div className="mt-4 bg-zinc-950 border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      {/* Header */}
      <div className="bg-[#d9ff00] border-b-4 border-black px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#d9ff00] font-black text-sm">
            VC
          </div>
          <div>
            <div className="font-black text-xl uppercase tracking-tight text-black leading-none">
              Verifiable Credential
            </div>
            <div className="text-[10px] font-black uppercase text-black/50 mt-0.5">
              EligibilityCredential · ZyndAISignature2024
            </div>
          </div>
        </div>
        <span className="bg-black text-[#d9ff00] text-[10px] font-black uppercase px-3 py-1 rounded-full">
          VERIFIED ✓
        </span>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5 text-white">
        {/* DID */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Subject DID</div>
          <div className="font-mono text-xs text-[#d9ff00] break-all">{did}</div>
        </div>

        {/* Profile */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Age",      value: profile.age },
              { label: "State",    value: profile.state || "—" },
              { label: "Category", value: profile.category || "—" },
              { label: "Income",   value: profile.income_bracket },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3">
                <div className="text-[9px] font-black uppercase text-white/40">{label}</div>
                <div className="font-black text-sm mt-0.5 capitalize">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Eligibility summary */}
        {elig && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Eligible Schemes ({elig.totalSchemes})
            </div>
            <div className="space-y-2">
              {elig.schemes?.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-2">
                  <span className="font-bold text-sm">{s.name}</span>
                  <span className="text-[10px] font-black text-[#d9ff00] uppercase">
                    Rank #{s.rank} · {s.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates + Issuer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
          <div>
            <div className="text-[9px] font-black uppercase text-white/40">Issued</div>
            <div className="text-xs font-bold mt-0.5">{issued}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase text-white/40">Expires</div>
            <div className="text-xs font-bold mt-0.5">{expires}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase text-white/40">Issuer</div>
            <div className="text-xs font-bold mt-0.5 truncate">{vc.issuer?.name ?? "Policy Navigator"}</div>
          </div>
        </div>

        {/* Raw JSON toggle */}
        <details className="group">
          <summary className="cursor-pointer text-[10px] font-black uppercase text-white/30 hover:text-white/60 select-none">
            View raw credential JSON ▾
          </summary>
          <pre className="mt-3 text-[10px] bg-white/5 p-4 rounded-xl overflow-x-auto font-mono text-white/60 max-h-64">
            {JSON.stringify(vc, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
