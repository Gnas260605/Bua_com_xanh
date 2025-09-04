export default function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white/95 shadow-md hover:shadow-lg transition-shadow p-0 ${className}`}
      {...props}
    />
  );
}

