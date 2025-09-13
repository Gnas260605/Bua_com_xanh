export default function Badge({ children, color = "emerald" }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs rounded-full ${map[color]||map.slate} shadow-sm`}>{children}</span>;
}
