export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const raw = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return dateStr ?? "";
  const n = Math.round((Date.now() - t) / 60000);
  if (n < 1) return "just now";
  if (n < 60) return `${n}m ago`;
  const h = Math.floor(n / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

export function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
