const METRICS = [
  { label: "Mailing list", source: "Klaviyo / Mailchimp" },
  { label: "DTC orders", source: "Offset Commerce" },
  { label: "Wholesale pipeline", source: "Manual" },
  { label: "Tasting appointments", source: "Manual" },
];

export default function GrowthMetricsPanel() {
  return (
    <section className="panel-surface rounded-sm shadow-panel transition-colors">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b hairline">
        <div className="min-w-0">
          <div className="eyebrow">Panel 04</div>
          <h2 className="display-serif text-2xl text-parchment-100 leading-tight mt-1 truncate">
            Growth Metrics
          </h2>
          <div className="text-xs text-parchment-500 mt-2">
            Deferred for v1 · placeholder only
          </div>
        </div>
        <div className="shrink-0">
          <span className="text-[10px] tracking-eyebrow uppercase text-parchment-500/70">
            Later
          </span>
        </div>
      </div>
      <div className="px-6 py-5 max-h-[32rem] overflow-y-auto panel-scroll">
        <p className="text-sm text-parchment-500 italic leading-relaxed">
          Per the plan, the metrics panel is intentionally empty until you have a
          few of these instrumented. An empty dashboard panel is worse than a
          smaller, full one.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {METRICS.map(({ label, source }) => (
            <div
              key={label}
              className="border hairline rounded-sm px-4 py-3 bg-ink-700/40"
            >
              <div className="eyebrow">{label}</div>
              <div className="display-serif text-3xl text-parchment-300 mt-1 leading-none">
                —
              </div>
              <div className="text-[10px] tracking-eyebrow uppercase text-parchment-500/60 mt-2">
                {source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
