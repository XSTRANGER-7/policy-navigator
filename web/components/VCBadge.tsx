export default function VCBadge({ vc }: { vc: any }) {
  if (!vc) return null

  return (
    <div className="mt-6 p-4 border rounded bg-green-50">
      <h3 className="font-semibold text-green-700">
        Verified Eligibility Credential Issued
      </h3>

      <pre className="text-xs mt-2 bg-white p-2 rounded overflow-x-auto">
        {JSON.stringify(vc, null, 2)}
      </pre>
    </div>
  )
}