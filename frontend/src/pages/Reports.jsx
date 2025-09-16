// src/pages/Reports.jsx
// Unit-aware reports for mixed campaigns (money vs meals)
// - Detects each campaign's primary metric and renders the right unit
// - KPIs show both total money and total meals
// - Cards display the correct progress (money or meals). If hybrid, show both
// - Detail modal lets you switch between Money / Meals charts

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import {
  X,
  Search,
  Filter,
  ArrowUpWideNarrow,
  BarChart3,
  Users,
  Target,
  MapPin,
  Download,
  Image as ImageIcon,
  CalendarRange,
  UtensilsCrossed,
  BadgeDollarSign,
} from "lucide-react";
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  Legend,
} from "recharts";

/* ================= Helpers ================= */
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const pctProgress = (raised, goal) => {
  const g = Math.max(0, toNum(goal));
  const r = Math.max(0, toNum(raised));
  if (g <= 0) return r > 0 ? 100 : 0;
  return clamp(Math.round((r / g) * 100));
};
const cov = (c) => c?.cover || c?.cover_url || c?.image || "";

// formatters
const fmtMoneyOnly = (v) => toNum(v).toLocaleString("vi-VN");
const fmtMoney = (v) => `${fmtMoneyOnly(v)} đ`;
const fmtMeals = (v) => `${toNum(v).toLocaleString("vi-VN")} bữa`;

// debounce
function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// robust metric detection per campaign
// Returns: 'money' | 'meals' | 'hybrid'
function detectMetric(c) {
  const moneyRaised = pickMoneyRaised(c);
  const moneyGoal = pickMoneyGoal(c);
  const mealsRaised = pickMealsRaised(c);
  const mealsGoal = pickMealsGoal(c);

  const hasMoney = toNum(moneyRaised) > 0 || toNum(moneyGoal) > 0;
  const hasMeals = toNum(mealsRaised) > 0 || toNum(mealsGoal) > 0;

  // explicit hints
  const unit = String(c?.unit || c?.units || c?.metric || c?.type || "").toLowerCase();
  const unitMeals = /(meal|bữa|suất)/.test(unit);
  const unitMoney = /(money|cash|đ|vnd|vnđ|dong|currency)/.test(unit);

  if (hasMoney && hasMeals) return "hybrid";
  if (unitMeals || hasMeals) return "meals";
  if (unitMoney || hasMoney) return "money";
  // fallback to money to keep backward compatibility
  return "money";
}

// field pickers (support multiple backend shapes)
function pickMoneyRaised(c) {
  return (
    toNum(c?.raised_amount) ||
    toNum(c?.money_raised) ||
    toNum(c?.donations_amount) ||
    0
  );
}
function pickMoneyGoal(c) {
  return toNum(c?.goal) || toNum(c?.money_goal) || 0;
}
function pickMealsRaised(c) {
  return (
    toNum(c?.meals_raised) ||
    toNum(c?.raised_meals) ||
    toNum(c?.meals) ||
    toNum(c?.total_meals) ||
    0
  );
}
function pickMealsGoal(c) {
  return toNum(c?.meal_goal) || toNum(c?.meals_goal) || toNum(c?.goal_meals) || 0;
}

/* ================= Small UI ================= */
function ProgressBar({ pct, gradient = "from-emerald-600 via-teal-600 to-cyan-600" }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-500`}
        style={{ width: `${clamp(pct)}%` }}
      />
    </div>
  );
}

// Việt hoá trạng thái + giữ tông màu cũ
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "active"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : s === "archived" || s === "closed"
      ? "bg-slate-50 text-slate-800 ring-slate-200"
      : "bg-sky-50 text-sky-800 ring-sky-200";

  const label =
    s === "active"
      ? "Đang chạy"
      : s === "closed"
      ? "Đã đóng"
      : s === "archived"
      ? "Lưu trữ"
      : s === "draft"
      ? "Nháp"
      : status || "Không rõ";

  return (
    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function MetricChip({ kind }) {
  const isMoney = kind === "money";
  const Icon = isMoney ? BadgeDollarSign : UtensilsCrossed;
  const bg = isMoney
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : "bg-sky-50 text-sky-800 ring-sky-200";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ring-1 ${bg}`}>
      <Icon size={12} /> {isMoney ? "Tiền" : "Bữa"}
    </span>
  );
}

/* ================= Page ================= */
export default function Reports() {
  const [items, setItems] = useState(null); // null=loading
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  // toolbar
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all"); // all | active | closed | draft | archived
  const [sort, setSort] = useState("progress"); // progress | raised | supporters | newest (server handled)
  const [year, setYear] = useState("all");
  const [metricFilter, setMetricFilter] = useState("all"); // all | money | meals | hybrid
  const [viewMode, setViewMode] = useState("auto"); // auto | money | meals (how to render cards)
  const debouncedQ = useDebounced(q, 350);

  // fetch list
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setItems(null);
        const qs = new URLSearchParams({
          page: "1",
          pageSize: "36",
          q: debouncedQ,
          status,
          sort,
          year: year === "all" ? "" : year,
        }).toString();
        const res = await apiGet(`/api/reports/campaigns?${qs}`);
        if (!alive) return;
        const list = Array.isArray(res?.items) ? res.items : [];
        setItems(list);
        setTotal(res?.total ?? list.length);
      } catch {
        if (!alive) return;
        setItems([]);
        setTotal(0);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedQ, status, sort, year]);

  // enhance + filter by metric
  const listRaw = useMemo(() => {
    return (items || []).map((c) => {
      const metric = detectMetric(c);
      const mRaised = pickMoneyRaised(c);
      const mGoal = pickMoneyGoal(c);
      const bRaised = pickMealsRaised(c);
      const bGoal = pickMealsGoal(c);
      return {
        ...c,
        _metric: metric, // money | meals | hybrid
        _moneyRaised: mRaised,
        _moneyGoal: mGoal,
        _mealsRaised: bRaised,
        _mealsGoal: bGoal,
        _pctMoney: pctProgress(mRaised, mGoal),
        _pctMeals: pctProgress(bRaised, bGoal),
        _supporters: toNum(c.supporters),
      };
    });
  }, [items]);

  const list = useMemo(() => {
    const filtered = listRaw.filter((x) => metricFilter === "all" || x._metric === metricFilter);
    return filtered;
  }, [listRaw, metricFilter]);

  // KPI tổng (both domains)
  const kpi = useMemo(() => {
    const moneySet = listRaw.filter((x) => x._moneyRaised > 0 || x._moneyGoal > 0);
    const mealsSet = listRaw.filter((x) => x._mealsRaised > 0 || x._mealsGoal > 0);

    const sumRaisedMoney = moneySet.reduce((s, x) => s + x._moneyRaised, 0);
    const sumGoalMoney = moneySet.reduce((s, x) => s + Math.max(0, x._moneyGoal), 0);
    const avgPctMoney = moneySet.length
      ? Math.round(moneySet.reduce((s, x) => s + x._pctMoney, 0) / moneySet.length)
      : 0;

    const sumRaisedMeals = mealsSet.reduce((s, x) => s + x._mealsRaised, 0);
    const sumGoalMeals = mealsSet.reduce((s, x) => s + Math.max(0, x._mealsGoal), 0);
    const avgPctMeals = mealsSet.length
      ? Math.round(mealsSet.reduce((s, x) => s + x._pctMeals, 0) / mealsSet.length)
      : 0;

    const activeCount = listRaw.filter((x) => (x.status || "").toLowerCase() === "active").length;
    return { sumRaisedMoney, sumGoalMoney, avgPctMoney, sumRaisedMeals, sumGoalMeals, avgPctMeals, activeCount };
  }, [listRaw]);

  /* ----- States ----- */
  if (items === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-100" />
          <div className="h-8 w-64 bg-slate-100 rounded" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!listRaw.length) {
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

      {/* KPIs (money + meals) */}
      <div className="grid md:grid-cols-6 gap-3">
        <KpiCard label="Tổng tiền đã quyên góp" value={fmtMoney(kpi.sumRaisedMoney)} icon={<BadgeDollarSign />} tone="money" />
        <KpiCard label="Mục tiêu tiền" value={fmtMoney(kpi.sumGoalMoney)} icon={<Target />} tone="money-muted" />
        <KpiCard label="Tiến độ tiền (TB)" value={`${kpi.avgPctMoney}%`} icon={<BarChart3 />} tone="money" />
        <KpiCard label="Tổng bữa đã quyên góp" value={fmtMeals(kpi.sumRaisedMeals)} icon={<UtensilsCrossed />} tone="meals" />
        <KpiCard label="Mục tiêu bữa" value={fmtMeals(kpi.sumGoalMeals)} icon={<Target />} tone="meals-muted" />
        <KpiCard label="Chiến dịch đang chạy" value={kpi.activeCount.toLocaleString("vi-VN")} icon={<Users />} tone="neutral" />
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
            <select className="input h-10 w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang chạy</option>
              <option value="closed">Đã đóng</option>
              <option value="archived">Lưu trữ</option>
              <option value="draft">Nháp</option>
            </select>
          </div>

          {/* year */}
          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-slate-500" />
            <select className="input h-10 w-36" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">Tất cả năm</option>
              {Array.from({ length: 7 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>

          {/* metric filter */}
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={16} className="text-slate-500" />
            <select className="input h-10 w-44" value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)}>
              <option value="all">Tất cả loại chiến dịch</option>
              <option value="money">Chỉ tiền</option>
              <option value="meals">Chỉ bữa</option>
              <option value="hybrid">Cả hai (hybrid)</option>
            </select>
          </div>

          {/* view mode */}
          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpWideNarrow size={16} className="text-slate-500" />
            <select className="input h-10 w-56" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="auto">Hiển thị tự động (đúng đơn vị)</option>
              <option value="money">Ưu tiên hiển thị tiền</option>
              <option value="meals">Ưu tiên hiển thị bữa</option>
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
            <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] bg-white h-full overflow-hidden">
              {/* cover */}
              <div className="relative h-28 w-full bg-slate-100">
                {cov(c) ? (
                  <img
                    src={cov(c)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-slate-400">
                    <ImageIcon size={22} />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <MetricChip kind={c._metric === "hybrid" ? (viewMode === "meals" ? "meals" : "money") : c._metric} />
                  <StatusBadge status={c.status} />
                </div>
              </div>

              <div className="p-5">
                <div className="font-semibold text-lg leading-snug text-slate-900 line-clamp-2">{c.title}</div>

                <div className="mt-1 text-sm text-slate-600 flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" />
                  {c.location || "—"}
                </div>

                {/* Metrics block */}
                {renderCardMetrics(c, viewMode)}
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

// ==== FIX hiển thị thẻ: không 0/0, ẩn progress khi không có mục tiêu, Việt hoá footer ====
function renderCardMetrics(c, viewMode) {
  const showMoney =
    c._metric === "money" || (c._metric === "hybrid" && (viewMode === "auto" || viewMode === "money"));
  const showMeals =
    c._metric === "meals" || (c._metric === "hybrid" && (viewMode === "auto" || viewMode === "meals"));

  const moneyRaised = toNum(c._moneyRaised);
  const moneyGoal = toNum(c._moneyGoal);
  const mealsRaised = toNum(c._mealsRaised);
  const mealsGoal = toNum(c._mealsGoal);

  const hasMoneyGoal = moneyGoal > 0;
  const hasMealsGoal = mealsGoal > 0;

  const moneyText = hasMoneyGoal
    ? `${fmtMoneyOnly(moneyRaised)} / ${fmtMoneyOnly(moneyGoal)} đ`
    : moneyRaised > 0
    ? `${fmtMoneyOnly(moneyRaised)} đ`
    : "—";

  const mealsText = hasMealsGoal
    ? `${mealsRaised.toLocaleString("vi-VN")} / ${mealsGoal.toLocaleString("vi-VN")} bữa`
    : mealsRaised > 0
    ? `${mealsRaised.toLocaleString("vi-VN")} bữa`
    : "—";

  const showMoneyProgress = hasMoneyGoal || moneyRaised > 0;
  const showMealsProgress = hasMealsGoal || mealsRaised > 0;

  const pctMoney = c._pctMoney;
  const pctMeals = c._pctMeals;

  // Footer text cho % mục tiêu
  const footerRight =
    c._metric === "meals"
      ? hasMealsGoal
        ? `${pctMeals}% mục tiêu bữa`
        : `Không đặt mục tiêu bữa`
      : c._metric === "money"
      ? hasMoneyGoal
        ? `${pctMoney}% mục tiêu tiền`
        : `Không đặt mục tiêu tiền`
      : // hybrid
        `${hasMoneyGoal ? `${pctMoney}% tiền` : `Không mục tiêu tiền`} · ${
          hasMealsGoal ? `${pctMeals}% bữa` : `Không mục tiêu bữa`
        }`;

  return (
    <div>
      {showMoney && (
        <>
          <div className="mt-4 mb-2 flex justify-between text-[15px] text-slate-800">
            <span>Đã quyên góp (tiền)</span>
            <span className="font-bold text-emerald-700 tabular-nums">{moneyText}</span>
          </div>
          {showMoneyProgress && <ProgressBar pct={pctMoney} />}
        </>
      )}

      {showMeals && (
        <>
          <div className={`${showMoney ? "mt-3" : "mt-4"} mb-2 flex justify-between text-[15px] text-slate-800`}>
            <span>Đã quyên góp (bữa)</span>
            <span className="font-bold text-sky-700 tabular-nums">{mealsText}</span>
          </div>
          {showMealsProgress && (
            <ProgressBar pct={pctMeals} gradient="from-sky-600 via-cyan-600 to-emerald-600" />
          )}
        </>
      )}

      <div className="mt-3 flex justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Users size={14} className="text-slate-400" />
          {toNum(c._supporters).toLocaleString("vi-VN")} người ủng hộ
        </span>
        <span className="inline-flex items-center gap-1">
          <Target size={14} className="text-slate-400" />
          {footerRight}
        </span>
      </div>
    </div>
  );
}

/* ================= KPI Card ================= */
function KpiCard({ label, value, icon, tone = "neutral" }) {
  const toneMap = {
    money: "bg-emerald-100 ring-emerald-200 text-emerald-700",
    "money-muted": "bg-emerald-50 ring-emerald-200 text-emerald-700",
    meals: "bg-sky-100 ring-sky-200 text-sky-700",
    "meals-muted": "bg-sky-50 ring-sky-200 text-sky-700",
    neutral: "bg-slate-100 ring-slate-200 text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
      <div className={`shrink-0 h-10 w-10 grid place-items-center rounded-xl ring-1 ${toneMap[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-600">{label}</div>
        <div className="text-lg font-bold text-slate-900 tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}

/* ================= Modal wrapper ================= */
function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div className="relative max-w-6xl w-full rounded-3xl bg-white shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ================= Modal content ================= */
function ReportDetail({ campaignId, onClose }) {
  const [detail, setDetail] = useState(null); // { item, series, donors?, latest? }
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState("bar"); // bar | line
  const [metric, setMetric] = useState("auto"); // auto | money | meals

  const dlRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet(`/api/reports/campaigns/${encodeURIComponent(campaignId)}`);
        if (!alive) return;
        setDetail(res || null);
        // default metric mode based on detected metric
        const m = detectMetric(res?.item || {});
        setMetric(m === "hybrid" ? "auto" : m);
      } catch {
        if (!alive) return;
        setDetail(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
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
  const moneyRaised = pickMoneyRaised(c);
  const moneyGoal = pickMoneyGoal(c);
  const mealsRaised = pickMealsRaised(c);
  const mealsGoal = pickMealsGoal(c);
  const pctMoney = pctProgress(moneyRaised, moneyGoal);
  const pctMeals = pctProgress(mealsRaised, mealsGoal);

  // series: [{ month:"2025-01", value: <money>, meals: <qty> }]
  const series = Array.isArray(detail.series) ? detail.series : [];
  const seriesNorm = series.map((s) => ({ month: s.month || s.label || "—", value: toNum(s.value), meals: toNum(s.meals) }));

  // decide which dataset to chart
  const chartMetric = metric === "auto" ? (detectMetric(c) === "meals" ? "meals" : "money") : metric;

  // CSV export (both columns)
  const exportCSV = () => {
    const header = "month,value,meals\n";
    const body = seriesNorm.map((r) => `${r.month},${r.value},${r.meals}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = dlRef.current || document.createElement("a");
    a.href = url;
    a.download = `campaign_${c.id}_series.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <div className="p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-12 w-12 grid place-items-center rounded-xl bg-emerald-100 ring-1 ring-emerald-200 text-emerald-700">
          <BarChart3 />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 line-clamp-2">{c.title}</h2>
          <div className="text-sm text-slate-600">{c.description || "—"}</div>
        </div>
        <button className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
      </div>

      {/* Tabs header area: metric + export */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-slate-600">Hiển thị</span>
          <select className="input h-9 w-40" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="auto">Tự động (đúng đơn vị)</option>
            <option value="money">Theo tiền</option>
            <option value="meals">Theo bữa</option>
          </select>
        </div>
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-slate-600">Dạng biểu đồ</span>
          <select className="input h-9 w-32" value={chartType} onChange={(e) => setChartType(e.target.value)}>
            <option value="bar">Cột</option>
            <option value="line">Đường</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm" onClick={exportCSV}>
            <Download size={14} /> Xuất CSV
          </button>
          <a ref={dlRef} className="hidden" />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Đã quyên góp (tiền)" value={fmtMoney(moneyRaised)} />
        <StatBox label="Mục tiêu (tiền)" value={fmtMoney(moneyGoal)} />
        <StatBox label="Đã quyên góp (bữa)" value={fmtMeals(mealsRaised)} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Mục tiêu (bữa)</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{fmtMeals(mealsGoal)}</div>
          <div className="mt-2">
            <ProgressBar pct={pctMeals} gradient="from-sky-600 via-cyan-600 to-emerald-600" />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Thống kê theo tháng</h3>
        </div>

        <div className="h-80 rounded-2xl border border-slate-200 bg-white/60">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <RBarChart data={seriesNorm.length ? seriesNorm : [{ month: "—", value: 0, meals: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(m) => (m?.includes("-") ? m.split("-")[1] : m)} />
                <YAxis />
                <Tooltip
                  formatter={(v, n) =>
                    n === (chartMetric === "meals" ? "meals" : "value")
                      ? chartMetric === "meals"
                        ? [fmtMeals(v), "Bữa"]
                        : [fmtMoney(v), "Quyên góp"]
                      : [toNum(v).toLocaleString("vi-VN"), n === "meals" ? "Bữa" : "Khác"]
                  }
                  labelFormatter={(l) => (l?.includes("-") ? `Tháng ${l.split("-")[1]}` : l)}
                />
                <Legend />
                {chartMetric === "meals" ? (
                  <Bar dataKey="meals" name="Bữa" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                ) : (
                  <Bar dataKey="value" name="Quyên góp" fill="#10b981" radius={[8, 8, 0, 0]} />
                )}
              </RBarChart>
            ) : (
              <LineChart data={seriesNorm.length ? seriesNorm : [{ month: "—", value: 0, meals: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(m) => (m?.includes("-") ? m.split("-")[1] : m)} />
                <YAxis />
                <Tooltip
                  formatter={(v, n) =>
                    n === (chartMetric === "meals" ? "meals" : "value")
                      ? chartMetric === "meals"
                        ? fmtMeals(v)
                        : fmtMoney(v)
                      : toNum(v).toLocaleString("vi-VN")
                  }
                  labelFormatter={(l) => (l?.includes("-") ? `Tháng ${l.split("-")[1]}` : l)}
                />
                <Legend />
                {chartMetric === "meals" ? (
                  <Line dataKey="meals" name="Bữa" stroke="#38bdf8" strokeWidth={2} dot={false} />
                ) : (
                  <Line dataKey="value" name="Quyên góp" stroke="#10b981" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latest transactions (money or meals) */}
      <DonationsPanel detail={detail} />
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

/* ================= Donations Panel ================= */
function DonationsPanel({ detail }) {
  const list = Array.isArray(detail?.latest) ? detail.latest : [];

  if (!list.length) {
    return <div className="p-6 text-slate-600">Chưa có danh sách giao dịch gần đây (hoặc API chưa trả về).</div>;
  }

  // detect whether list contains meals, money, or both
  const hasMeals = list.some((d) => toNum(d.meals || d.qty || d.quantity) > 0);
  const hasMoney = list.some((d) => toNum(d.amount) > 0);

  return (
    <div className="p-2 sm:p-4">
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2.5">Thời gian</th>
              <th className="text-left px-3 py-2.5">Người ủng hộ</th>
              {hasMoney && <th className="text-right px-3 py-2.5">Số tiền</th>}
              {hasMeals && <th className="text-right px-3 py-2.5">Số bữa</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => {
              const when = new Date(d.at || d.created_at || Date.now()).toLocaleString("vi-VN");
              const donor = d.donor || d.name || "—";
              const amount = toNum(d.amount);
              const meals = toNum(d.meals || d.qty || d.quantity);
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-slate-700">{when}</td>
                  <td className="px-3 py-2.5">{donor}</td>
                  {hasMoney && (
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {amount ? fmtMoneyOnly(amount) + " đ" : "—"}
                    </td>
                  )}
                  {hasMeals && (
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {meals ? meals.toLocaleString("vi-VN") : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
