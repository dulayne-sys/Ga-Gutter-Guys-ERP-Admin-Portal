type StatCardProps = {
  label: string;
  value: string;
  sublabel?: string;
};

export function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      {sublabel ? <p className="mt-1.5 text-xs text-slate-400">{sublabel}</p> : null}
    </article>
  );
}
