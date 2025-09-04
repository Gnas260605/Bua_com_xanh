const fmt = (n) =>
  (n ?? 0).toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const fallback =
  "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1200&auto=format&fit=crop";

export default function CampaignCard({ c }) {
  const pct = Math.min(100, Math.round((c.raised / (c.goal || 1)) * 100));
  const cover = c.cover && c.cover.length > 4 ? c.cover : fallback;

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div className="relative">
        <img src={cover} alt="" className="h-40 w-full object-cover" />
        <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {c.location || "—"}
        </span>
        <span className="absolute top-3 right-3 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">
          {pct}% đạt mục tiêu
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg leading-tight">{c.title}</h3>
        <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: pct + "%" }} />
        </div>
        <p className="mt-2 text-sm text-gray-700">
          Đã gây quỹ <b>{fmt(c.raised)}</b> / Mục tiêu <b>{fmt(c.goal)}</b> • {c.supporters} người ủng hộ
        </p>

        <div className="mt-3 flex gap-2 flex-wrap">
          {(c.tags || []).map((t) => (
            <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700">#{t}</span>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700">
            Ủng hộ nhanh
          </button>
          <button className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border bg-white hover:bg-gray-50 border-gray-200 text-gray-700">
            Chi tiết
          </button>
        </div>
      </div>
    </article>
  );
}
