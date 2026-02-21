export default function VCBadge({ vc }: { vc: any }) {
  if (!vc) return null;

  return (
    <div className="mt-8 bg-[#d9ff00] border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-[#d9ff00] font-black text-sm">
          VC
        </div>
        <h3 className="font-black text-lg uppercase tracking-tight">
          Verified Eligibility Credential
        </h3>
      </div>

      <pre className="text-xs bg-white p-4 rounded-xl overflow-x-auto border-3 border-black font-mono">
        {JSON.stringify(vc, null, 2)}
      </pre>
    </div>
  );
}
