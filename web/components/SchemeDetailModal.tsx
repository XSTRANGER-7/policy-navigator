"use client";

import type { RankedScheme } from "@/types/scheme";

interface SchemeDetailModalProps {
  scheme: RankedScheme;
  onClose: () => void;
  onApply: (scheme: RankedScheme) => void;
  isPartialMatch?: boolean;
}

const CATEGORY_COLOR: Record<string, string> = {
  farmer: "bg-green-100 text-green-800",
  student: "bg-blue-100 text-blue-800",
  women: "bg-pink-100 text-pink-800",
  bpl: "bg-orange-100 text-orange-800",
  disabled: "bg-purple-100 text-purple-800",
  senior_citizen: "bg-amber-100 text-amber-800",
  sc_st: "bg-red-100 text-red-800",
  obc: "bg-indigo-100 text-indigo-800",
  health: "bg-teal-100 text-teal-800",
  general: "bg-gray-100 text-gray-700",
};

export default function SchemeDetailModal({
  scheme,
  onClose,
  onApply,
  isPartialMatch = false,
}: SchemeDetailModalProps) {
  const catColor =
    CATEGORY_COLOR[scheme.category?.toLowerCase()] ?? CATEGORY_COLOR.general;
  const eligible = scheme.eligible;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-[#e4e4db] border-4 border-black rounded-t-3xl sm:rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="sticky top-0 bg-[#e4e4db] border-b-4 border-black px-6 pt-5 pb-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-black/20 ${catColor}`}>
                {scheme.category}
              </span>
              {eligible ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#d9ff00] border border-black/20">
                  ✓ Eligible
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 border border-orange-300 text-orange-700">
                  Partial Match
                </span>
              )}
              {scheme.relevance_score !== undefined && (
                <span className="text-[10px] font-black uppercase bg-black text-[#d9ff00] px-2 py-0.5 rounded-full">
                  {scheme.relevance_score}% match
                </span>
              )}
            </div>
            <h2 className="font-black text-2xl uppercase tracking-tight leading-tight">
              {scheme.name}
            </h2>
            {scheme.ministry && (
              <p className="text-black/40 font-bold text-xs mt-0.5">{scheme.ministry}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-black text-lg hover:bg-black/70 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Description */}
          <p className="font-bold text-black/70 leading-relaxed">{scheme.description}</p>

          {/* Benefits */}
          <div className="bg-[#d9ff00] border-3 border-black rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Benefits</p>
            <p className="font-black text-lg text-black leading-snug">{scheme.benefits}</p>
          </div>

          {/* Eligibility criteria */}
          <div className="bg-white border-3 border-black rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">
              Eligibility Criteria
            </p>
            <p className="font-bold text-black/80 text-sm">{scheme.eligibility_text}</p>
          </div>

          {/* Why you match / don't match */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scheme.reasons_pass && scheme.reasons_pass.length > 0 && (
              <div className="bg-green-50 border-2 border-green-400 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-green-700 mb-2">Why you qualify</p>
                <ul className="space-y-1">
                  {scheme.reasons_pass.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-green-800">
                      <span className="flex-shrink-0">✓</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scheme.reasons_fail && scheme.reasons_fail.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-red-600 mb-2">Doesn&apos;t fully match</p>
                <ul className="space-y-1">
                  {scheme.reasons_fail.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-red-700">
                      <span className="flex-shrink-0">✗</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[#e4e4db] border-t-4 border-black px-6 py-4 flex gap-3">
          {eligible ? (
            <button
              onClick={() => onApply(scheme)}
              className="flex-1 bg-black text-[#d9ff00] font-black uppercase py-3 rounded-full text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
            >
              Apply Now →
            </button>
          ) : (
            <div className="flex-1 bg-orange-50 border-2 border-orange-300 rounded-full py-3 text-center font-black uppercase text-xs text-orange-600">
              Not fully eligible — fix criteria above to apply
            </div>
          )}
          {scheme.official_url && (
            <a
              href={scheme.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-white border-3 border-black rounded-full font-black text-xs uppercase hover:bg-[#d9ff00] transition-colors"
            >
              Official Site ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
