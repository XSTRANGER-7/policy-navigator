import CitizenForm from "@/components/CitizenForm";

export default async function EligibilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await (searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>));
  const defaultCategory = typeof params.category === "string" ? params.category : "";

  return (
    <section className="px-6 py-16 md:px-12 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-[#d9ff00] border-2 border-black rounded-full px-4 py-1 font-black text-[10px] md:text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
          AGENT-POWERED ELIGIBILITY CHECK
        </div>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
          CHECK YOUR <br />
          <span className="text-transparent [-webkit-text-stroke:3px_black]">
            ELIGIBILITY.
          </span>
        </h1>

        <p className="mt-4 text-lg font-bold text-black/50 italic font-mono">
          ** Enter your details and our AI agent will find all schemes you
          qualify for.
        </p>
      </div>

      {/* The Form */}
      <CitizenForm defaultCategory={defaultCategory} />
    </section>
  );
}
