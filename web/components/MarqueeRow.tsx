export default function MarqueeRow({
  items,
  bg,
  text,
  reverse = false,
}: {
  items: string[];
  bg: string;
  text: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`${bg} ${text} py-3 overflow-hidden whitespace-nowrap border-b-2 border-black`}
    >
      <div
        className={`inline-block whitespace-nowrap ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <span
            key={i}
            className="font-black text-sm md:text-md mx-8 inline-flex items-center gap-3 uppercase tracking-tighter"
          >
            {item} <span className="w-2 h-2 bg-current rotate-45" />
          </span>
        ))}
      </div>
    </div>
  );
}
