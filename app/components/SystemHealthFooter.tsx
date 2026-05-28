"use client";

import { useEffect, useState } from "react";

export default function SystemHealthFooter() {
  const [status, setStatus] = useState<string>("Checking status…");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status ?? "Unknown");
        setOk(d.ok ?? false);
      })
      .catch(() => {
        setStatus("Status check failed");
        setOk(false);
      });
  }, []);

  return (
    <div className="text-[10px] tracking-eyebrow uppercase text-parchment-500/50 flex items-center gap-2 py-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          ok === null
            ? "bg-parchment-500/40 animate-pulse"
            : ok
            ? "bg-brass-500/80"
            : "bg-oxblood-500"
        }`}
      />
      {status}
    </div>
  );
}
