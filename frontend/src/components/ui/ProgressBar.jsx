export default function ProgressBar({ value = 0, className = "" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`h-2.5 rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className="h-full bg-emerald-600 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
