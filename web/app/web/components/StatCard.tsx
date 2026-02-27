type StatCardProps = {
  label: string;
  value: string;
  sublabel?: string;
};

export function StatCard({ label, value, sublabel }: StatCardProps) {
  /* Auto-size: short values get text-2xl, long values (emails etc.) get text-base */
  const sizeClass = value.length > 14 ? "text-base" : value.length > 8 ? "text-lg" : "text-2xl";

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 ${sizeClass} font-bold tracking-tight text-white truncate`}>{value}</p>
      {sublabel ? <p className="mt-1 text-[11px] text-slate-400">{sublabel}</p> : null}
    </article>
  );
}
