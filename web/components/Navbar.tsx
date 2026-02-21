"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AgentStatus from "./AgentStatus";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/eligibility", label: "Citizens" },
    { href: "/policies", label: "Policies" },
    { href: "/dashboard", label: "Trust" },
  ];

  return (
    <nav className="w-full flex items-center justify-between px-4 md:px-8 py-4 bg-[#d9ff00]">
      <div className="flex items-center gap-6 md:gap-12">
        <Link
          href="/"
          className="bg-black text-[#d9ff00] font-black text-xl px-3 py-1 -rotate-2 border-2 border-black transform transition-transform hover:rotate-0 cursor-pointer"
        >
          CIVIS AI
        </Link>
        <div className="hidden lg:flex gap-8 font-black uppercase text-xs tracking-widest text-black/70">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`hover:text-black transition-colors ${
                pathname === l.href
                  ? "text-black underline underline-offset-4 decoration-2"
                  : ""
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <AgentStatus />
        </div>
        <Link
          href="/dashboard"
          className="bg-white border-2 border-black px-6 py-1.5 rounded-full font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
        >
          Portal Access
        </Link>
      </div>
    </nav>
  );
}
