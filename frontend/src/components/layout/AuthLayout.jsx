import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-sky-50/50">
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-xl font-semibold">
            <span>🍚</span> <span>Bữa Cơm Xanh</span>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
