// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import {
  X, Search, Filter, ArrowUpWideNarrow, BarChart3, Users, Target, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ========== helpers ========== */
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pctProgress = (raised, goal) =>
  Math.min(100, Math.round((toNum(raised) / Math.max(1, toNum(goal))) * 100));

function ProgressBar({ pct }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ========== Page ========== */
export default function Reports() {
  const [items, setItems] = useState(null);   // null = loading, [] = empty
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  // toolbar (server-side)
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");      // all | active | closed | draft
  const [sort, setSort] = useState("progress");     // progress | raised | supporters | newest
  const debouncedQ = useDebounced(q, 300);

  // fetch list whenever filters change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setItems(null); // show skeleton
        const qs = new URLSearchParams({
          page: "1",
          pageSize: "30",
          q: debouncedQ,
          status,
          sort,
        }).toString();
        const res = await apiGet(`/api/reports/campaigns?${qs}`);
        if (!alive) return;
        setItems(res?.items || []);
        setTotal(res?.total ?? (res?.items?.length || 0));
      } catch {
        if (!alive) return;
        setItems([]);
        setTotal(0);
      }
    })();
    return () => { alive = false; };
  }, [debouncedQ, status, sort]);

  // tính % tiến độ local cho thẻ
  const list = useMemo(() => {
    return (items || []).map((c) => ({
      ...c,
      _pct: pctProgress(c.raised_amount, c.goal),
    }));
  }, [items]);

  /* ----- UI states ----- */
  if (items === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-100" />
          <div className="h-8 w-64 bg-slate-100 rounded" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="Chưa có chiến dịch nào" hint="Tạo chiến dịch để xem báo cáo." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <BarChart3 className="text-emerald-600" /> Báo cáo theo chiến dịch
        </h1>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          Đang hiển thị <b>{list.length}</b> / {total} chiến dịch
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input h-10 w-72 pl-9"
              placeholder="Tìm theo tên/địa điểm/mô tả…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* status */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              className="input h-10 w-44"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang chạy</option>
              <option value="closed">Đã đóng</option>
              <option value="draft">Nháp</option>
            </select>
          </div>

          {/* sort */}
          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpWideNarrow size={16} className="text-slate-500" />
            <select
              className="input h-10 w-52"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="progress">Tiến độ (cao → thấp)</option>
              <option value="raised">Tiền quyên góp (cao → thấp)</option>
              <option value="supporters">Người ủng hộ (nhiều → ít)</option>
              <option value="newest">Mới tạo gần đây</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className="text-left cursor-pointer group rounded-3xl p-[1.5px] bg-[conic-gradient(at_20%_-10%,#34d39933,transparent_25%,#38bdf833,transparent_60%,#a78bfa33)] transition hover:shadow-xl hover:-translate-y-0.5"
          >
            <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] bg-white h-full p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-lg leading-snug text-slate-900 line-clamp-2">
                  {c.title}
                </div>
                <span
                  className={[
                    "shrink-0 text-[11px] px-2 py-0.5 rounded-full ring-1",
                    (c.status || "") === "active"
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : "bg-slate-50 text-slate-800 ring-slate-200",
                  ].join(" ")}
                >
                  {c.status || "unknown"}
                </span>
              </div>

              <div className="mt-1 text-sm text-slate-600 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" />
                {c.location || "—"}
              </div>

              <div className="mt-4 mb-2 flex justify-between text-[15px] text-slate-800">
                <span>Đã quyên góp</span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {toNum(c.raised_amount).toLocaleString("vi-VN")} /{" "}
                  {toNum(c.goal).toLocaleString("vi-VN")}
                </span>
              </div>
              <ProgressBar pct={c._pct} />

              <div className="mt-3 flex justify-between text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Users size={14} className="text-slate-400" />
                  {toNum(c.supporters).toLocaleString("vi-VN")} người ủng hộ
                </span>
                <span className="inline-flex items-center gap-1">
                  <Target size={14} className="text-slate-400" /> {c._pct}% mục tiêu
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {selectedId && (
        <Modal onClose={() => setSelectedId(null)}>
          <ReportDetail campaignId={selectedId} onClose={() => setSelectedId(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ========== Modal wrapper ========== */
function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative max-w-5xl w-full rounded-3xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ========== Modal content (load real data) ========== */
function ReportDetail({ campaignId, onClose }) {
  const [detail, setDetail] = useState(null); // { item, series }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet(`/api/reports/campaigns/${encodeURIComponent(campaignId)}`);
        if (!alive) return;
        setDetail(res || null);
      } catch {
        if (!alive) return;
        setDetail(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [campaignId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-7 w-72 bg-slate-100 rounded mb-4" />
        <Skeleton className="h-24 mb-4" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!detail?.item) {
    return (
      <div className="p-6">
        <div className="text-slate-700">Không tải được dữ liệu báo cáo.</div>
        <div className="mt-4 text-right">
          <button className="px-4 py-2 rounded-xl border hover:bg-slate-50" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const c = detail.item;
  const pct = pctProgress(c.raised_amount, c.goal);
  const series = Array.isArray(detail.series) ? detail.series : [];

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-12 w-12 grid place-items-center rounded-xl bg-emerald-100 ring-1 ring-emerald-200 text-emerald-700">
          <BarChart3 />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 line-clamp-2">
            {c.title}
          </h2>
          <div className="text-sm text-slate-600">{c.description || "—"}</div>
        </div>
        <button
          className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Đã quyên góp</div>
          <div className="mt-0.5 text-2xl font-bold text-emerald-700 tabular-nums">
            {toNum(c.raised_amount).toLocaleString("vi-VN")} đ
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Mục tiêu</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">
            {toNum(c.goal).toLocaleString("vi-VN")} đ
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Người ủng hộ</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">
            {toNum(c.supporters).toLocaleString("vi-VN")}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Tiến độ</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{pct}%</div>
          <div className="mt-2">
            <ProgressBar pct={pct} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Thống kê quyên góp theo tháng</h3>
          <div className="text-xs text-slate-500">
            Đơn vị: <b>đồng</b>
          </div>
        </div>
        <div className="h-72 rounded-2xl border border-slate-200 bg-white/60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series.length ? series : [{ month: "—", value: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => (m?.includes("-") ? m.split("-")[1] : m)}
              />
              <YAxis />
              <Tooltip
                formatter={(v) => [toNum(v).toLocaleString("vi-VN") + " đ", "Quyên góp"]}
                labelFormatter={(l) => (l?.includes("-") ? `Tháng ${l.split("-")[1]}` : l)}
              />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
