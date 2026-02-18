import Link from "next/link";

type HubCardProps = {
  href: string;
  title: string;
  subtitle: string;
  metric: string;
  metricSub: string;
  icon: string;
};

export function HubCard({ href, title, subtitle, metric, metricSub, icon }: HubCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-white/[0.07]"
    >
      <p className="text-lg">{icon}</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      <p className="mt-4 text-2xl font-semibold text-indigo-200">{metric}</p>
      <p className="text-xs text-slate-500">{metricSub}</p>
    </Link>
  );
}
