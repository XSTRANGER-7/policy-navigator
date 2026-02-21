import Link from "next/link";

const POLICIES = [
  {
    name: "PM-KISAN",
    category: "Farmer",
    description:
      "Direct income support of ₹6,000/year to small and marginal farmer families.",
    eligibility: "Land-owning farmer families with cultivable land.",
  },
  {
    name: "Ayushman Bharat (PM-JAY)",
    category: "Health",
    description:
      "Health insurance cover of ₹5 lakh per family per year for secondary and tertiary hospitalization.",
    eligibility: "BPL families as per SECC 2011 data.",
  },
  {
    name: "PM Ujjwala Yojana",
    category: "Women / BPL",
    description:
      "Free LPG connections to women from Below Poverty Line households.",
    eligibility: "Women from BPL households not having LPG connection.",
  },
  {
    name: "National Pension Scheme (NPS)",
    category: "Senior Citizen",
    description:
      "Contributory pension system for organized and unorganized sector workers.",
    eligibility: "Indian citizen aged 18–70 years.",
  },
  {
    name: "Post Matric Scholarship (SC/ST)",
    category: "SC/ST Students",
    description:
      "Financial assistance for SC/ST students pursuing post-matriculation education.",
    eligibility: "SC/ST students with family income below ₹2.5 lakh/year.",
  },
  {
    name: "Indira Gandhi National Disability Pension",
    category: "Disabled",
    description:
      "Monthly pension of ₹300 for persons with severe disabilities living below poverty line.",
    eligibility: "BPL persons with 80%+ disability, aged 18–79.",
  },
  {
    name: "MUDRA Loan Scheme",
    category: "General / Entrepreneur",
    description:
      "Loans up to ₹10 lakh for non-corporate, non-farm small/micro enterprises.",
    eligibility:
      "Any Indian citizen with a business plan for a non-farm income activity.",
  },
  {
    name: "Sukanya Samriddhi Yojana",
    category: "Women",
    description:
      "Small savings scheme for the girl child with attractive interest rates and tax benefits.",
    eligibility: "Girl child below age of 10 years.",
  },
];

export default function PoliciesPage() {
  return (
    <section className="px-6 py-16 md:px-12 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-[#d9ff00] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          POLICY DATABASE
        </div>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          GOVERNMENT <br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">
            POLICIES.
          </span>
        </h1>

        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** Browse key government schemes and programs. Check your eligibility
          using our AI agent.
        </p>
      </div>

      {/* Policy Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {POLICIES.map((policy, i) => (
          <div
            key={i}
            className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="text-[10px] font-black text-black/30 mb-1">
                  #{String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-black text-xl uppercase tracking-tight text-black">
                  {policy.name}
                </h3>
              </div>
              <span className="flex-shrink-0 bg-[#d9ff00] border-2 border-black px-3 py-1 text-[10px] font-black uppercase rounded-full">
                {policy.category}
              </span>
            </div>
            <p className="text-sm font-bold text-black/60 mb-3">
              {policy.description}
            </p>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Eligibility
              </span>
              <p className="text-sm font-medium text-black/70 mt-0.5">
                {policy.eligibility}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-zinc-950 border-4 border-black rounded-2xl p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white mb-4">
          NOT SURE WHICH SCHEME{" "}
          <span className="text-[#d9ff00]">FITS YOU?</span>
        </h2>
        <p className="text-gray-400 font-bold mb-8 max-w-xl mx-auto">
          Let our AI agent analyze your profile and automatically find all the
          government schemes you qualify for.
        </p>
        <Link
          href="/eligibility"
          className="inline-block bg-[#d9ff00] text-black px-10 py-4 rounded-full font-black uppercase text-lg shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform"
        >
          Check Eligibility Now →
        </Link>
      </div>
    </section>
  );
}
