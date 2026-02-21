"use client";

import { useState, useEffect } from "react";

export default function Loader({ onComplete }: { onComplete: () => void }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(onComplete, 800);
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 bg-black z-[100] flex items-center justify-center transition-opacity duration-700"
      style={{ opacity }}
    >
      <div className="bg-[#d9ff00] px-6 py-2 -rotate-3 border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
        <h1 className="text-black font-black text-4xl md:text-6xl tracking-tighter uppercase italic">
          CIVIS AI
        </h1>
      </div>
    </div>
  );
}
