type KpiCardProps = {
  label: string;
  value: string;
  accent?: string;
};

export const KpiCard = ({ label, value, accent = "text-emerald-200" }: KpiCardProps) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
};
