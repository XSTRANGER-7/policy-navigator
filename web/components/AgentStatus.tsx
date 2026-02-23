"use client";

import { useState, useEffect } from "react";

export default function AgentStatus() {
  const [status, setStatus] = useState<"loading" | "online" | "offline">(
    "loading",
  );
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/agent");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status === "ok" ? "online" : "offline");
          setAgentId(data.agent_id ?? null);
          setAgentUrl(data.agent_url ?? null);
        } else {
          setStatus("offline");
        }
      } catch {
        setStatus("offline");
      }
    }
    check();
  }, []);

  const dotColor =
    status === "online"
      ? "bg-black"
      : status === "offline"
        ? "bg-[#ff5c8d]"
        : "bg-yellow-500";

  const label =
    status === "online"
      ? "AGENT LIVE"
      : status === "offline"
        ? "AGENT DOWN"
        : "CHECKING...";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest text-black/60">
          {label}
        </span>
        {agentUrl && status !== "online" ? (
          <span className="text-[9px] text-black/40">{agentUrl}</span>
        ) : null}
      </div>
    </div>
  );
}
