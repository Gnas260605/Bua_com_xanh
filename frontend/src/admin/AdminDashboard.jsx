// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import {
  Users as UsersIcon,
  Megaphone,
  CreditCard,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastAt, setLastAt] = useState(null);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const s = await apiGet("/api/admin/stats");
      setStats(s);
      setLastAt(new Date());
    } catch (e) {
      setErr(e?.message || "Load stats failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const nf = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const usersTotal = stats?.users?.total ?? 0;
  const campaignsTotal = stats?.campaigns?.total ?? 0;

  // Payments: tổng số dòng (rows)
  const paymentsRows = useMemo(() => {
    if (!Array.isArray(stats?.payments)) return 0;
    return stats.payments.reduce((a, b) => a + (b?.c ?? b?.count ?? 0), 0);
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">
            Tổng quan hệ thống •{" "}
            {lastAt ? (
              <span>Cập nhật: {formatTime(lastAt)}</span>
            ) : (
              "Chưa cập nhật"
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 active:scale-[.98] transition"
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Error banner */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Không tải được dữ liệu</div>
            <div className="text-sm opacity-90">{err}</div>
          </div>
        </div>
      )}

      {/* Skeleton when loading first time */}
      {loading && !stats ? (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <SkeletonPanel />
            <SkeletonPanel />
          </div>
        </>
      ) : null}

      {/* Content */}
      {stats && (
        <>
          {/* Stat cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              title="Users"
              value={nf.format(usersTotal)}
              icon={UsersIcon}
              hint="Tổng số người dùng"
            />
            <StatCard
              title="Campaigns"
              value={nf.format(campaignsTotal)}
              icon={Megaphone}
              hint="Tổng số chiến dịch"
            />
            <StatCard
              title="Payments (rows)"
              value={nf.format(paymentsRows)}
              icon={CreditCard}
              hint="Tổng số bản ghi thanh toán"
            />
          </div>

          {/* Charts / Lists */}
          <div className="grid lg:grid-cols-2 gap-4">
            <UsersByRole byRole={stats?.users?.byRole} />
            <PaymentsBreakdown rows={stats?.payments} />
          </div>
        </>
      )}
    </div>
  );
}

/* ============= Subcomponents ============= */

function StatCard({ title, value, icon: Icon, hint }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm">
      {/* Accent blur */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-emerald-300/30 to-teal-300/20 blur-2xl" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">{title}</div>
          <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
          {hint ? <div className="mt-1 text-xs text-gray-400">{hint}</div> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl border bg-gray-50 p-3 text-gray-600">
            <Icon className="h-6 w-6" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UsersByRole({ byRole }) {
  const data = Array.isArray(byRole) ? byRole : [];
  const max = data.reduce(
    (m, r) => Math.max(m, Number(r?.c ?? r?.count ?? 0)),
    0
  );

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Users by role</h2>
        <span className="text-xs text-gray-400">
          {data.length ? `${data.length} nhóm` : "Không có dữ liệu"}
        </span>
      </div>

      {data.length === 0 ? (
        <EmptyState text="Chưa có thống kê theo vai trò" />
      ) : (
        <ul className="space-y-3">
          {data.map((r) => {
            const label = String(r?.role ?? r?.name ?? "—");
            const count = Number(r?.c ?? r?.count ?? 0);
            const pct = max > 0 ? Math.round((count / max) * 100) : 0;
            return (
              <li key={label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="tabular-nums text-gray-600">{count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                    aria-label={`${label} ${count}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PaymentsBreakdown({ rows }) {
  const list = Array.isArray(rows) ? rows : [];

  // Tự động nhận diện nhãn (provider/status/method/…)
  const labelKey = useMemo(() => {
    if (!list.length) return null;
    const prefer = ["provider", "status", "method", "day", "name", "label"];
    const keys = Object.keys(list[0] ?? {});
    const found = prefer.find((k) => keys.includes(k));
    if (found) return found;
    // fallback: lấy key string đầu tiên khác count
    return keys.find((k) => !["c", "count"].includes(k)) ?? null;
  }, [list]);

  const countKey = useMemo(() => {
    if (!list.length) return null;
    const keys = Object.keys(list[0] ?? {});
    if (keys.includes("c")) return "c";
    if (keys.includes("count")) return "count";
    return null;
  }, [list]);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Payments breakdown</h2>
        <span className="text-xs text-gray-400">
          {list.length ? `${list.length} mục` : "Không có dữ liệu"}
        </span>
      </div>

      {!list.length || !labelKey || !countKey ? (
        <EmptyState text="Chưa có dữ liệu chi tiết thanh toán" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium capitalize">{labelKey}</th>
                <th className="px-3 py-2 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{String(r?.[labelKey] ?? "—")}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {Number(r?.[countKey] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============= UI bits ============= */

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text = "No data" }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-gray-500">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-100">
        <span className="block h-1.5 w-1.5 rounded bg-gray-300" />
      </span>
      {text}
    </div>
  );
}

/* ============= helpers ============= */

function formatTime(d) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return d?.toLocaleString?.() ?? String(d);
  }
}
