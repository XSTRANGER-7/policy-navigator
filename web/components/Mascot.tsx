"use client";

import { useState, useEffect } from "react";

export default function Mascot() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quotes = [
    "No red tape, just results",
    "Trust-backed, actually clear",
    "Public policy made simple",
    "Everyone accesses support",
    "Verify, Discover, Benefit",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center animate-bounce duration-[4000ms]">
      {/* Speech Bubble */}
      <div className="absolute -top-20 right-0 md:-right-12 bg-[#d9ff00] border-4 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[180px] z-10 rotate-2">
        <p className="text-xs md:text-sm font-black text-center leading-tight">
          &quot;{quotes[quoteIndex]}&quot;
        </p>
        <div className="absolute -bottom-3 left-6 w-5 h-5 bg-[#d9ff00] border-r-4 border-b-4 border-black rotate-45" />
      </div>

      {/* Character */}
      <div className="w-48 h-48 md:w-64 md:h-64 bg-[#d9ff00] rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)] flex items-center justify-center relative overflow-hidden group">
        <svg viewBox="0 0 100 100" className="w-full h-full p-6">
          <ellipse cx="38" cy="42" rx="6" ry="10" fill="black" />
          <ellipse cx="62" cy="42" rx="6" ry="10" fill="black" />
          <path
            d="M 30 65 Q 50 75 70 65"
            stroke="black"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="28" cy="58" r="6" fill="#00e5ff" />
          <circle cx="72" cy="58" r="6" fill="#00e5ff" />
          <path
            d="M 50 15 L 50 25 M 40 18 L 45 23 M 60 18 L 55 23"
            stroke="black"
            strokeWidth="3"
          />
        </svg>
      </div>
    </div>
  );
}
