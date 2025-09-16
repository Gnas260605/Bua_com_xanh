export default function BadgePill({ children, tone = "emerald", className = "" }) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    sky: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${map[tone]} ${className}`}>
      {children}
    </span>
  );
}
