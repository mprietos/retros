import React, { useEffect, useMemo, useState } from "react";

export function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Timer({ endTime }: { endTime: number | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, []);

  const remaining = useMemo(() => {
    if (!endTime) return null;
    return Math.max(0, endTime - now);
  }, [endTime, now]);

  if (!endTime) return <span className="text-gray-500">Sin iniciar</span>;
  return <span className="font-mono text-xl">{formatMs(remaining ?? 0)}</span>;
}


