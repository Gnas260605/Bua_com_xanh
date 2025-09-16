// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import {
  Users as UsersIcon,
  Megaphone,
  CreditCard,
  RefreshCcw,
  AlertCircle,
  Wifi,
  WifiOff,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useToast } from "../components/ui/Toast";

/* ================= Helpers ================= */
const toInt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const sumCounts = (arr) =>
  Array.isArray(arr) ? arr.reduce((a, b) => a + toInt(b?.c ?? b?.count ?? 0), 0) : 0;

function getCounts(s) {
  return {
    users: toInt(s?.users?.total ?? 0),
    campaigns: toInt(s?.campaigns?.total ?? 0),
    paymentRows: sumCounts(s?.payments),
  };
}

function fmtTimeVi(d) {
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

/* =============== Main =============== */
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [eta, setEta] = useState(0); // giây còn lại để tự refresh
  const controllerRef = useRef(null);
  const prevCountsRef = useRef(null);
  const mountedRef = useRef(false);
  const t = useToast();

  const nf = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const usersTotal = stats?.users?.total ?? 0;
  const campaignsTotal = stats?.campaigns?.total ?? 0;
  const paymentsRows = useMemo(() => sumCounts(stats?.payments), [stats]);

  // Ngưỡng thay đổi để thông báo (tránh spam các thay đổi nhỏ)
  const CHANGE_THRESHOLD = 1; // >=1 mới báo

  // Counter ETA cho auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    setEta(15); // mỗi 15s tự tải
    const iv = setInterval(() => {
      setEta((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (eta === 0) {
      // Tự refresh nhưng không phát toast “tải”, chỉ báo nếu thay đổi lớn
      load({ origin: "auto" });
      setEta(15);
    }
  }, [eta, autoRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lần đầu mount: tải nhưng KHÔNG phát toast (tránh spam)
  useEffect(() => {
    load({ origin: "init" });
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load({ origin = "manual" } = {}) {
    // Hủy request cũ nếu còn
    if (controllerRef.current) controllerRef.current.abort();
    const ctl = new AbortController();
    controllerRef.current = ctl;

    const isManual = origin === "manual";
    const isInit = origin === "init";
    const isAuto = origin === "auto";

    try {
      setErr("");
      setLoading(true);
      if (isManual) {
        t.info("Đang tải số liệu…", { duration: 800 });
      }

      const s = await apiGet("/api/admin/stats", { signal: ctl.signal });
      const now = new Date();
      setStats(s);
      setLastAt(now);

      // So sánh thay đổi
      const cur = getCounts(s);
      const prev = prevCountsRef.current;

      if (!prev) {
        // Lần đầu: không toast
      } else {
        const dUsers = cur.users - prev.users;
        const dCamps = cur.campaigns - prev.campaigns;
        const dPays = cur.paymentRows - prev.paymentRows;
        const bigChange =
          Math.abs(dUsers) >= CHANGE_THRESHOLD ||
          Math.abs(dCamps) >= CHANGE_THRESHOLD ||
          Math.abs(dPays) >= CHANGE_THRESHOLD;

        // Chỉ báo khi manual hoặc auto có thay đổi lớn
        if ((isManual || isAuto) && bigChange) {
          const lines = [
            Math.abs(dUsers) >= CHANGE_THRESHOLD
              ? `Users: ${trend(dUsers)} (tổng ${nf.format(cur.users)})`
              : null,
            Math.abs(dCamps) >= CHANGE_THRESHOLD
              ? `Campaigns: ${trend(dCamps)} (tổng ${nf.format(cur.campaigns)})`
              : null,
            Math.abs(dPays) >= CHANGE_THRESHOLD
              ? `Payments: ${trend(dPays)} (rows, tổng ${nf.format(cur.paymentRows)})`
              : null,
          ]
            .filter(Boolean)
            .join("\n");
          t.success({ title: "Dữ liệu có thay đổi", description: lines, duration: 3500 });
        } else if (isManual) {
          t.info({ title: "Đã cập nhật", description: "Không có thay đổi đáng kể." });
        }
      }

      prevCountsRef.current = cur;
    } catch (e) {
      if (e?.name === "AbortError") return; // bị hủy do request mới
      const msg = e?.message || "Load stats failed";
      setErr(msg);
      t.error({ title: "Không tải được dữ liệu", description: msg, duration: 4500 });
    } finally {
      setLoading(false);
    }
  }

  const trend = (n) =>
    n > 0 ? `↑ +${nf.format(n)}` : n < 0 ? `↓ -${nf.format(Math.abs(n))}` : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-40 rounded-full bg-teal-200/30 blur-3xl" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2 py-0.5 text-xs text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
                Live overview
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Tổng quan hệ thống •{" "}
              {lastAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Cập nhật: {fmtTimeVi(lastAt)}
                </span>
              ) : (
                "Chưa cập nhật"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                autoRefresh
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-white hover:bg-gray-50"
              }`}
              title="Bật/tắt tự động làm mới"
            >
              {autoRefresh ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-500" />
              )}
              {autoRefresh ? `Tự làm mới (${eta}s)` : "Tự làm mới: tắt"}
            </button>

            <button
              onClick={() => load({ origin: "manual" })}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 active:scale-[.98] transition"
              disabled={loading}
              title="Làm mới"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Không tải được dữ liệu</div>
              <div className="text-sm opacity-90">{err}</div>
            </div>
          </div>
        )}
      </div>

      {/* Loading skeleton khi chưa có dữ liệu lần đầu */}
      {!stats && loading ? (
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
              accent="from-emerald-300/30 to-teal-300/30"
            />
            <StatCard
              title="Campaigns"
              value={nf.format(campaignsTotal)}
              icon={Megaphone}
              hint="Tổng số chiến dịch"
              accent="from-cyan-300/30 to-sky-300/30"
            />
            <StatCard
              title="Payments (rows)"
              value={nf.format(paymentsRows)}
              icon={CreditCard}
              hint="Tổng số bản ghi thanh toán"
              accent="from-violet-300/30 to-fuchsia-300/30"
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

function StatCard({ title, value, icon: Icon, hint, accent = "from-emerald-300/30 to-teal-300/20" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} blur-2xl`} />
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
  const max = data.reduce((m, r) => Math.max(m, toInt(r?.c ?? r?.count ?? 0)), 0);

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
            const count = toInt(r?.c ?? r?.count ?? 0);
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

  // Lấy hợp nhất keys để xác định cột nhãn tốt nhất
  const labelKey = useMemo(() => {
    if (!list.length) return null;
    const preferred = ["provider", "status", "method", "day", "name", "label"];
    const allKeys = Array.from(
      list.reduce((set, r) => {
        Object.keys(r ?? {}).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
    const found = preferred.find((k) => allKeys.includes(k));
    if (found) return found;
    // fallback: lấy key đầu tiên không phải count
    return allKeys.find((k) => !["c", "count"].includes(k)) ?? null;
  }, [list]);

  const countKey = useMemo(() => {
    if (!list.length) return null;
    const keys = Object.keys(list[0] ?? {});
    if (keys.includes("c")) return "c";
    if (keys.includes("count")) return "count";
    // fallback: nếu không có c/count thì coi như không hợp lệ
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
                  <td className="px-3 py-2 tabular-nums">{toInt(r?.[countKey] ?? 0)}</td>
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
