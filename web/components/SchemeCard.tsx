"use client";

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  started:             { label: "Started",        cls: "bg-gray-100 text-gray-600 border-gray-300" },
  documents_submitted: { label: "Docs Submitted", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  under_review:        { label: "Under Review",   cls: "bg-yellow-100 text-yellow-800 border-yellow-400" },
  approved:            { label: "Approved ✓",     cls: "bg-green-100 text-green-700 border-green-400" },
  rejected:            { label: "Rejected",       cls: "bg-red-100 text-red-700 border-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE_MAP[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`text-[9px] font-black uppercase px-2 py-1 border-2 rounded-full ${b.cls}`}>
      {b.label}
    </span>
  );
}

interface SchemeCardProps {
  name: string;
  description?: string;
  eligibility?: string;
  benefits?: string;
  index?: number;
  score?: number;
  reasons?: string[];
  isPartialMatch?: boolean;
  isApplied?: boolean;
  applicationStatus?: string;
  onDetails?: () => void;
  onApply?: () => void;
}

export default function SchemeCard({
  name,
  description,
  eligibility,
  benefits,
  index = 0,
  score,
  reasons,
  isPartialMatch = false,
  isApplied = false,
  applicationStatus,
  onDetails,
  onApply,
}: SchemeCardProps) {
  return (
    <div
      className={
        "bg-white border-4 border-black rounded-2xl p-6 transition-all " +
        "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] " +
        (isPartialMatch ? "border-orange-300" : "")
      }
    >
      <div className="flex items-start gap-4">
        {/* Rank badge */}
        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#d9ff00] border-3 border-black flex items-center justify-center text-sm font-black">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="font-black text-xl uppercase tracking-tight text-black leading-tight">
              {name}
            </h3>
            {score !== undefined && (
              <span className="flex-shrink-0 bg-black text-[#d9ff00] text-[10px] font-black uppercase px-2 py-1 rounded-full">
                {score}% match
              </span>
            )}
          </div>

          {description && (
            <p className="text-black/60 mt-1 text-sm font-bold leading-snug">{description}</p>
          )}

          {benefits && (
            <div className="mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Benefits</span>
              <p className="text-black font-bold text-sm mt-0.5">{benefits}</p>
            </div>
          )}

          {eligibility && (
            <div className="mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Eligibility</span>
              <p className="text-black/70 text-sm font-medium mt-0.5">{eligibility}</p>
            </div>
          )}

          {reasons && reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {reasons.map((r, i) => (
                <span
                  key={i}
                  className="text-[9px] font-black uppercase bg-[#d9ff00]/40 border border-black/10 rounded-full px-2 py-0.5 text-black/60"
                >
                  ✓ {r}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {(onDetails || onApply || isApplied) && (
            <div className="mt-4 flex gap-2 flex-wrap items-center">
              {onDetails && (
                <button
                  onClick={onDetails}
                  className="text-[10px] font-black uppercase px-3 py-1.5 bg-white border-2 border-black rounded-full hover:bg-[#d9ff00] transition-colors"
                >
                  View Details
                </button>
              )}
              {isApplied ? (
                <>
                  <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-[#d9ff00] border-2 border-black text-black rounded-full flex items-center gap-1">
                    ✓ Applied
                  </span>
                  {applicationStatus && (
                    <StatusBadge status={applicationStatus} />
                  )}
                </>
              ) : (
                <>
                  {onApply && !isPartialMatch && (
                    <button
                      onClick={onApply}
                      className="text-[10px] font-black uppercase px-3 py-1.5 bg-black text-[#d9ff00] border-2 border-black rounded-full hover:bg-black/70 transition-colors"
                    >
                      Apply Now →
                    </button>
                  )}
                  {isPartialMatch && (
                    <span className="text-[9px] font-black uppercase px-2 py-1 bg-orange-100 border border-orange-300 text-orange-700 rounded-full">
                      Near Match
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
