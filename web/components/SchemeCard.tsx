"use client";

interface SchemeCardProps {
  name: string;
  description?: string;
  eligibility?: string;
  benefits?: string;
  index?: number;
}

export default function SchemeCard({
  name,
  description,
  eligibility,
  benefits,
  index = 0,
}: SchemeCardProps) {
  return (
    <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#d9ff00] border-3 border-black flex items-center justify-center text-sm font-black">
          {index + 1}
        </span>
        <div className="flex-1">
          <h3 className="font-black text-xl uppercase tracking-tight text-black">
            {name}
          </h3>
          {description && (
            <p className="text-black/60 mt-1 text-sm font-bold">
              {description}
            </p>
          )}
          {eligibility && (
            <div className="mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Eligibility
              </span>
              <p className="text-black/70 text-sm font-medium mt-0.5">
                {eligibility}
              </p>
            </div>
          )}
          {benefits && (
            <div className="mt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Benefits
              </span>
              <p className="text-black font-bold text-sm mt-0.5">{benefits}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
