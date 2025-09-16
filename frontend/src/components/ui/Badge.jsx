export default function Badge({ children, tone="muted", className="" }) {
  const map = {
    muted: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    blue:  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    red:   "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    gray:  "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white",
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs border border-black/5 dark:border-white/5 ${map[tone]} ${className}`}>
      {children}
    </span>
  );
}
