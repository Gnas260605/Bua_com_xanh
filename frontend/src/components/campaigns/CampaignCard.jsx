// src/components/campaigns/CampaignCard.jsx
import { Link } from "react-router-dom";
import {
  Users,
  MapPin,
  Clock,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";

/* ================== Config ================== */
// Mặc định: 1 suất = 10.000đ (chỉ dùng cho chiến dịch loại meal)
const DEFAULT_MEAL_PRICE = 10000;
// QUAN TRỌNG: Money campaign không quy đổi ra suất
const PREFER_MEAL_FOR_MONEY = false;

/* ================== Helpers ================== */
function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function pick(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
function fmt(v, locale = "vi-VN") {
  return toNum(v).toLocaleString(locale);
}
function percent(raised, goal) {
  const p = goal > 0 ? Math.round((raised / goal) * 100) : 0;
  return Math.max(0, Math.min(100, p));
}
function safeJson(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * Chuẩn hóa số liệu:
 *  - moneyGoal, moneyRaised (VND)
 *  - mealGoal, mealRaised (suất) – CHỈ đọc từ meta/DB nếu có, KHÔNG tự quy đổi khi campaign là money.
 *  - mealPrice (VND/suất)
 */
function computeNumbers(c, isMealType) {
  const mealPrice =
    pick(c.meal_price, c.mealCost, c.meal_cost, DEFAULT_MEAL_PRICE) ||
    DEFAULT_MEAL_PRICE;

  // Tiền (VND) – đọc đúng từ DB nếu có
  const moneyGoal = pick(c.target_amount, c.money_goal, c.goal);
  const moneyRaised = pick(c.raised_amount, c.money_raised, c.raised);

  // Suất – chỉ lấy từ dữ liệu thật
  const mealGoalRaw = pick(c.target_portion, c.meal_goal, c.goal_meal, c.meal_target_qty);
  const mealRaisedRaw = pick(
    c.raised_portion,
    c.meal_raised,
    c.raised_meal,
    c.meal_received_qty
  );

  // Nếu là campaign "meal" mà thiếu dữ liệu suất, mới rơi về quy đổi từ tiền (để không bị trống UI)
  const mealGoal = isMealType
    ? (mealGoalRaw || (moneyGoal > 0 ? Math.floor(moneyGoal / mealPrice) : 0))
    : mealGoalRaw; // money-campaign: giữ nguyên (có thì hiện, không thì thôi)

  const mealRaised = isMealType
    ? (mealRaisedRaw || (moneyRaised > 0 ? Math.floor(moneyRaised / mealPrice) : 0))
    : mealRaisedRaw;

  return { moneyGoal, moneyRaised, mealGoal, mealRaised, mealPrice };
}

/**
 * Quyết định đơn vị hiển thị số chính (primary):
 * - Với "meal": ưu tiên suất
 * - Với "money": luôn tiền
 */
function resolveDisplayUnit({ type, displayUnit }) {
  const t = String(type || "").toLowerCase();
  if (displayUnit === "meal" || displayUnit === "money") return displayUnit;
  if (t === "meal") return "meal";
  return PREFER_MEAL_FOR_MONEY ? "meal" : "money"; // ở đây đang false → money
}

/* ---------- Formatters ---------- */
const moneyLabel = (v) => `${fmt(v)}đ`;
const mealLabel = (v, unit = "suất") => `${fmt(v)} ${unit}`;

/* ================== Component ================== */
/**
 * CampaignCard
 * - variant="public"  : thẻ/card cho trang ngoài
 * - variant="admin"   : hàng (row) cho trang admin
 *
 * Props:
 *  - c: object campaign từ DB (đã bao gồm meta/tags)
 *  - variant: "public" | "admin"
 *  - displayUnit: "auto" | "meal" | "money" (mặc định "auto")
 *  - onDonate(c), onEdit(c), onArchiveToggle(c), onDelete(c)
 */
export default function CampaignCard({
  c = {},
  variant = "public",
  displayUnit = "auto",
  onDonate,
  onEdit,
  onArchiveToggle,
  onDelete,
}) {
  const cover =
    c.cover ||
    c.cover_url ||
    c.cover_uri ||
    c.images?.[0] ||
    "/images/campaign-placeholder.jpg";

  const type = (c.type || c.kind || c.campaign_type || "").toLowerCase(); // "meal" | "money"
  const isMealType = type === "meal";
  const effectiveUnit = resolveDisplayUnit({ type, displayUnit });
  const isMealView = effectiveUnit === "meal";

  const {
    moneyGoal,
    moneyRaised,
    mealGoal,
    mealRaised,
    mealPrice,
  } = computeNumbers(c, isMealType);

  const mealUnit = c.meal_unit || c.meta?.meal?.unit || "phần";

  // Số liệu primary theo chế độ hiển thị
  const goal = isMealView ? mealGoal : moneyGoal;
  const raised = isMealView ? mealRaised : moneyRaised;

  const primaryGoalLabel = isMealView ? mealLabel(goal, mealUnit) : moneyLabel(goal);
  const primaryRaisedLabel = isMealView ? mealLabel(raised, mealUnit) : moneyLabel(raised);

  // Dòng quy đổi – CHỈ cho campaign meal (tiền <-> suất)
  const showConversions = isMealType;

  const moneyGoalFromMeal = moneyGoal || (goal > 0 ? goal * mealPrice : 0);
  const moneyRaisedFromMeal = moneyRaised || (raised > 0 ? raised * mealPrice : 0);
  const mealGoalFromMoney = mealGoal || (moneyGoal > 0 ? Math.floor(moneyGoal / mealPrice) : 0);
  const mealRaisedFromMoney = mealRaised || (moneyRaised > 0 ? Math.floor(moneyRaised / mealPrice) : 0);

  // Tiến độ: nếu là meal và có mục tiêu suất → dùng suất, nếu không thì dùng tiền
  const pct = isMealType && mealGoal > 0
    ? percent(mealRaised, mealGoal)
    : percent(moneyRaised, moneyGoal);

  const supporters =
    pick(c.supporters, c.backers, c.donors_count, c.supporters_count) || 0;

  const deadline = c.deadline || c.ends_at || c.end_date || c.closed_at || null;
  const daysLeft =
    deadline != null
      ? Math.max(0, Math.ceil((new Date(deadline) - new Date()) / 86400000))
      : null;

  const tagsRaw = c.tags ?? c.tag_list ?? null;
  const tags = Array.isArray(tagsRaw) ? tagsRaw : safeJson(tagsRaw) || [];

  /* ---------- Admin row ---------- */
  if (variant === "admin") {
    return (
      <div
        className="
          flex w-full items-center gap-4 rounded-2xl border bg-white px-3 py-2
          hover:shadow-md transition
        "
      >
        {/* Cover + Tiêu đề */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={cover}
            alt={c.title || "Campaign"}
            loading="lazy"
            decoding="async"
            className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-900">
              {c.title || "Chiến dịch"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {c.subtitle || c.description || "—"}
            </div>
          </div>
        </div>

        {/* Loại */}
        <div className="w-[92px] shrink-0">
          <Pill tone={isMealType ? "indigo" : "cyan"} label={isMealType ? "meal" : "money"} />
        </div>

        {/* Trạng thái */}
        <div className="w-[96px] shrink-0">
          <Pill
            tone={c.status === "active" ? "emerald" : "slate"}
            label={c.status || "unknown"}
          />
        </div>

        {/* Thanh toán */}
        <div className="w-[92px] shrink-0">
          <Pill tone="pink" label={c.payment || c.payment_method || "MoMo"} />
        </div>

        {/* Mục tiêu */}
        <div className="w-[180px] shrink-0 text-sm tabular-nums text-slate-900">
          <div className="font-medium">{moneyLabel(moneyGoal)}</div>
          {isMealType && (
            <div className="text-xs text-slate-500">
              {mealLabel(mealGoalFromMoney || mealGoal, mealUnit)}
            </div>
          )}
        </div>

        {/* Đã đạt */}
        <div className="w-[180px] shrink-0 text-sm tabular-nums text-slate-900">
          <div className="font-medium">{moneyLabel(moneyRaised)}</div>
          {isMealType && (
            <div className="text-xs text-slate-500">
              {mealLabel(mealRaisedFromMoney || mealRaised, mealUnit)}
            </div>
          )}
        </div>

        {/* Tiến độ */}
        <div className="w-[180px] shrink-0">
          <Progress value={pct} />
          <div className="mt-1 text-right text-xs tabular-nums text-slate-500">
            {pct}%
          </div>
        </div>

        {/* Thao tác */}
        <div className="flex w-[220px] shrink-0 items-center justify-end gap-2">
          <button
            onClick={() => onEdit?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            <Pencil size={16} />
            Sửa
          </button>

          <button
            onClick={() => onArchiveToggle?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {c.archived ? "Bỏ lưu trữ" : "Lưu trữ"}
          </button>

          <button
            onClick={() => onDelete?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
            title="Xoá"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Public card ---------- */
  return (
    <div
      className="
        group relative h-full rounded-3xl p-[1.5px]
        bg-[conic-gradient(at_20%_-10%,#6366f1_0%,#a855f7_30%,#06b6d4_60%,transparent_75%)]
        transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5
        overflow-hidden
      "
    >
      <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] overflow-hidden bg-white h-full flex flex-col">
        {/* Cover */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={cover}
            alt={c.title || "Chiến dịch"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {isMealType && (
            <span className="absolute top-3 left-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white shadow">
              Bữa ăn
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900">
            {c.title}
          </h3>

          {c.location && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-500" />
              <span>{c.location}</span>
            </div>
          )}

          {c.description && (
            <p className="line-clamp-2 text-sm text-slate-700">{c.description}</p>
          )}

          {/* Progress + stats */}
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Số liệu */}
            <div className="grid grid-cols-1 gap-1">
              {/* Dòng tiền: luôn hiển thị */}
              <div className="text-sm text-slate-800">
                Gây quỹ{" "}
                <b className="tabular-nums">{moneyLabel(moneyRaised)}</b>
                {moneyGoal > 0 ? (
                  <>
                    {" "} / <b className="tabular-nums">{moneyLabel(moneyGoal)}</b>
                  </>
                ) : null}
              </div>

              {/* Dòng bữa: chỉ hiển thị cho campaign meal */}
              {isMealType && (mealGoal > 0 || mealRaised > 0) && (
                <div className="text-sm text-slate-800">
                  Đã nhận{" "}
                  <b className="tabular-nums">{mealLabel(mealRaised, mealUnit)}</b>
                  {mealGoal > 0 ? (
                    <>
                      {" "} / <b className="tabular-nums">{mealLabel(mealGoal, mealUnit)}</b>
                    </>
                  ) : null}
                </div>
              )}

              {/* Quy đổi tương đương: chỉ cho meal (để người xem tiện hình dung) */}
              {showConversions && (
                <div className="text-xs text-slate-500">
                  Tương đương{" "}
                  <span className="tabular-nums">
                    {moneyLabel(mealRaisedFromMoney || moneyRaisedFromMeal)}
                  </span>
                  {moneyGoalFromMeal > 0 && (
                    <>
                      {" "} / <span className="tabular-nums">{moneyLabel(moneyGoalFromMeal)}</span>
                    </>
                  )}
                </div>
              )}

              {/* Supporters + ngày còn lại */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-700 pt-1">
                <span className="flex items-center gap-1">
                  <Users size={14} className="text-slate-500" />
                  <b className="tabular-nums">{fmt(supporters)}</b> người ủng hộ
                </span>
                {daysLeft !== null && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-500" /> Còn {daysLeft} ngày
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {!!tags?.length && (
            <div className="flex h-7 flex-wrap gap-2 overflow-hidden">
              {tags.slice(0, 4).map((t) => (
                <span
                  key={String(t)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-800 transition hover:bg-slate-50"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => onDonate?.(c)}
              className="
                w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600
                px-3 py-2 text-white shadow-sm transition hover:shadow active:brightness-95
                focus:outline-none focus:ring-2 ring-emerald-300
              "
            >
              Ủng hộ nhanh
            </button>

            <Link
              to={`/campaigns/${encodeURIComponent(c.id ?? c.slug ?? "")}`}
              className="
                w-full rounded-xl border border-slate-200 px-3 py-2 text-center
                text-slate-900 transition hover:bg-slate-50 active:bg-slate-100
                focus:outline-none focus:ring-2 ring-fuchsia-200
              "
            >
              Chi tiết
            </Link>
          </div>
        </div>
      </div>

      {/* Outer glow */}
      <div
        className="
          pointer-events-none absolute inset-0 rounded-3xl
          bg-[conic-gradient(at_10%_-10%,#6366f1,transparent_30%,#a855f7,transparent_60%,#06b6d4)]
          opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-35
        "
        aria-hidden="true"
      />
    </div>
  );
}

/* ---------- Small UI atoms ---------- */
function Pill({ label, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-2 text-xs font-medium ${toneMap[tone]}`}
      title={String(label)}
    >
      {label}
    </span>
  );
}

function Progress({ value = 0 }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
