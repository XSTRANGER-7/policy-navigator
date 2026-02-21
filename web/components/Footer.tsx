export default function Footer() {
  return (
    <footer className="bg-zinc-950 p-12 md:p-20 border-t-4 border-black relative">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#d9ff00 2px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 relative z-10">
        <div className="space-y-6">
          <div className="bg-white text-black font-black text-2xl px-4 py-1 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(217,255,0,1)]">
            CIVIS AI
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
              Built for Public Good &amp; Identity Sovereignty
            </p>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
              Powered by ZyndAI Agent on Render
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-10 md:gap-16">
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black uppercase text-sm text-gray-400 hover:text-[#d9ff00] transition-colors"
          >
            Twitter
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black uppercase text-sm text-gray-400 hover:text-[#d9ff00] transition-colors"
          >
            Github
          </a>
          <a
            href="#"
            className="font-black uppercase text-sm text-gray-400 hover:text-[#d9ff00] transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
}
