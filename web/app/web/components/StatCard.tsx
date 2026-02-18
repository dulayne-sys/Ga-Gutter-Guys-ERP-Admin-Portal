type StatCardProps = {
  label: string;
  value: string;
  sublabel?: string;
};

export function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-slate-400">{sublabel}</p> : null}
    </article>
  );
}
