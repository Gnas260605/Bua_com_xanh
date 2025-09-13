// src/components/campaigns/CampaignCard.jsx
import { Link } from "react-router-dom";
import { Users, MapPin, Clock } from "lucide-react";

export default function CampaignCard({ c, onDonate }) {
  const cover = c.cover || c.cover_url || c.images?.[0] || "/images/campaign-placeholder.jpg";
  const raised = Number(c.raised || c.raised_amount || 0);
  const goal = Number(c.goal || c.target_amount || 0);
  const pct = Math.min(100, Math.round((raised / Math.max(1, goal)) * 100));
  const daysLeft = c.deadline ? Math.max(0, Math.ceil((new Date(c.deadline) - new Date()) / 86400000)) : null;

  return (
    <div
      className="
        group relative h-full rounded-3xl p-[1.5px]
        bg-[conic-gradient(at_20%_-10%,#6366f1_0%,#a855f7_30%,#06b6d4_60%,transparent_75%)]
        transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5
        overflow-hidden  /* ✅ chặn mọi overflow từ glow/blur */
      "
    >
      <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] overflow-hidden bg-white h-full flex flex-col">
        {/* Cover */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={cover}
            alt={c.title || 'Chiến dịch'}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {c.type === 'meal' && (
            <span className="absolute top-3 left-3 px-2 py-0.5 text-xs rounded-full bg-emerald-600 text-white shadow">
              Bữa ăn
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          <h3 className="text-lg font-semibold leading-snug line-clamp-2 text-slate-900">{c.title}</h3>

          {c.location && (
            <div className="text-sm text-slate-600 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-500" />
              <span>{c.location}</span>
            </div>
          )}

          {c.description && (
            <p className="text-sm text-slate-700 line-clamp-2">{c.description}</p>
          )}

          {/* Progress + stats */}
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center text-sm text-slate-800 gap-x-4 gap-y-1">
              <span>
                Đã gây quỹ <b className="tabular-nums">{raised.toLocaleString('vi-VN')} đ</b>
                {goal ? ` / ${goal.toLocaleString('vi-VN')} đ` : ''}
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <Users size={14} className="text-slate-500" />
                <b className="tabular-nums">{c.supporters || 0}</b> người ủng hộ
              </span>
              {daysLeft !== null && (
                <span className="flex items-center gap-1 text-xs text-slate-700">
                  <Clock size={12} className="text-slate-500" /> Còn {daysLeft} ngày
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          {!!c.tags?.length && (
            <div className="flex gap-2 flex-wrap h-7 overflow-hidden">
              {c.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full text-[11px] border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onDonate?.(c)}
              className="
                w-full px-3 py-2 rounded-xl
                bg-gradient-to-r from-emerald-600 to-teal-600 text-white
                shadow-sm hover:shadow active:brightness-95
                transition focus:outline-none focus:ring-2 ring-emerald-300
              "
            >
              Ủng hộ nhanh
            </button>

            <Link
              to={`/campaigns/${encodeURIComponent(c.id)}`}
              className="
                w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900
                hover:bg-slate-50 active:bg-slate-100 transition text-center
                focus:outline-none focus:ring-2 ring-fuchsia-200
              "
            >
              Chi tiết
            </Link>
          </div>
        </div>
      </div>

      {/* Outer glow — đổi -inset-0.5 thành inset-0 để không tràn */}
      <div
        className="
          pointer-events-none absolute inset-0 rounded-3xl
          bg-[conic-gradient(at_10%_-10%,#6366f1,transparent_30%,#a855f7,transparent_60%,#06b6d4)]
          opacity-0 group-hover:opacity-35 blur-sm transition-opacity duration-500
        "
        aria-hidden="true"
      />
    </div>
  );
}
