// src/admin/AdminPayments.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCw,
  Eye,
  Copy,
  X,
} from "lucide-react";

/* ============== Helpers ============== */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const fmt = new Intl.NumberFormat("vi-VN");
const formatVND = (n) => `${fmt.format(Number(n || 0))}đ`;
const formatDateTime = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  // 09/09/2025 16:39
  return d.toLocaleString("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};
const METHODS = [
  { value: "", label: "Tất cả phương thức" },
  { value: "momo", label: "MoMo" },
  { value: "vnpay", label: "VNPay" },
  { value: "zalopay", label: "ZaloPay" },
  { value: "bank", label: "Chuyển khoản" },
  { value: "cash", label: "Tiền mặt" },
];
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "success", label: "Thành công" },
  { value: "pending", label: "Đang chờ" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Đã hoàn" },
];

function StatusBadge({ value }) {
  const map = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    refunded: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  const label =
    value === "success"
      ? "success"
      : value === "pending"
      ? "pending"
      : value === "refunded"
      ? "refunded"
      : "failed";
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[value || "pending"]}`}>
      {label}
    </span>
  );
}

function MethodPill({ value }) {
  const map = {
    momo: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
    vnpay: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    zalopay: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    bank: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    cash: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${map[value] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200"}`}>
      {value || "unknown"}
    </span>
  );
}

async function parseErrorResponse(r) {
  const status = r.status;
  const statusText = r.statusText || "";
  let msg = "";
  try {
    const body = await r.clone().json();
    msg = body?.message || body?.error || "";
  } catch {
    try { msg = await r.clone().text(); } catch {}
  }
  if (!msg) {
    if (status === 401) msg = "Thiếu quyền hoặc hết phiên (401).";
    else if (status === 403) msg = "Không có quyền (403).";
    else if (status === 404) msg = "Không tìm thấy (404).";
    else msg = `Yêu cầu thất bại (${status}).`;
  }
  return `${status} ${statusText} – ${msg}`;
}

/* Chuẩn hoá nhiều dạng response:
   - {items, total, page, pageSize, sum_amount}
   - {data: {items, total}} ... */
function normalizeResponse(res, fallback = {}) {
  const base = res?.items ? res : (res?.data?.items ? res.data : res || {});
  const items = Array.isArray(base.items) ? base.items : [];
  return {
    items,
    total: Number(base.total ?? items.length ?? 0),
    page: Number(base.page || fallback.page || 1),
    pageSize: Number(base.pageSize || fallback.pageSize || 10),
    sum_amount: Number(base.sum_amount || base.sum || 0),
  };
}

/* CSV helper */
function toCSV(rows) {
  if (!rows?.length) return "id,created_at,payer_id,campaign_id,amount,method,status,reference\n";
  const header = ["id", "created_at", "payer_id", "campaign_id", "amount", "method", "status", "reference"];
  const esc = (s) => {
    if (s == null) return "";
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const body = rows
    .map((r) =>
      header.map((k) => esc(r[k])).join(",")
    )
    .join("\n");
  return header.join(",") + "\n" + body + "\n";
}

function copy(text, t) {
  navigator.clipboard?.writeText(String(text ?? "")).then(
    () => t?.success?.("Đã sao chép"),
    () => t?.error?.("Không sao chép được")
  );
}

/* ============== Main ============== */
export default function AdminPayments() {
  const t = useToast();

  // filters
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10, sum_amount: 0 });

  // details modal
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  // load list
  async function load({ force } = {}) {
    setLoading(true);
    try {
      const nonce = force ? `&_=${Date.now()}` : "";
      const qs = new URLSearchParams({
        q: qDebounced,
        status,
        method,
        from: fromDate,
        to: toDate,
        page: String(page),
        pageSize: String(pageSize),
      }).toString();
      const res = await apiGet(`/api/admin/payments?${qs}${nonce}`);
      setData(normalizeResponse(res, { page, pageSize }));
    } catch (e) {
      console.error(e);
      setData({ items: [], total: 0, page, pageSize, sum_amount: 0 });
      t.error(
        e?.message?.startsWith?.("TypeError")
          ? "Không kết nối được server. Kiểm tra API/CORS."
          : e?.message || "Không tải được giao dịch."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [qDebounced, status, method, fromDate, toDate, page, pageSize]);
  useEffect(() => { load({ force: true }); /* eslint-disable-next-line */ }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(data.total || 0) / Number(pageSize || 10))),
    [data.total, pageSize]
  );

  // actions
  async function patch(id, nextStatus, confirmText) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    if (confirmText && !confirm(confirmText)) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) throw new Error(await parseErrorResponse(r));
      t.success("Đã cập nhật giao dịch");
      load({ force: true });
    } catch (e) {
      t.error(e?.message || "Cập nhật thất bại");
    }
  }

  async function openDetail(p) {
    setDetail({ ...p });
    // nếu backend có API /payments/:id -> fetch chi tiết
    try {
      setLoadingDetail(true);
      const res = await apiGet(`/api/admin/payments/${p.id}`); // nếu 404, sẽ fallback giữ nguyên
      if (res && (res.id || res.data?.id)) {
        setDetail(res?.data || res);
      }
    } catch {
      /* bỏ qua, giữ nguyên */
    } finally {
      setLoadingDetail(false);
    }
  }

  function exportCSV() {
    if (!data.items?.length) return t.error("Không có dữ liệu để xuất.");
    const csv = toCSV(data.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const from = fromDate || "start";
    const to = toDate || "now";
    a.download = `payments_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* search */}
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Tìm theo mã giao dịch, người trả, ref…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>

          {/* status */}
          <select className="input lg:w-48" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* method */}
          <select className="input lg:w-56" value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }}>
            {METHODS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* date range */}
          <div className="flex items-center gap-2">
            <input type="date" className="input" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
            <span className="text-slate-500">→</span>
            <input type="date" className="input" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
          </div>

          {/* right tools */}
          <div className="flex items-center gap-2 lg:ml-auto">
            <label className="text-sm text-slate-600">Hiển thị</label>
            <select
              className="input w-[90px]"
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}/trang</option>)}
            </select>

            <Button variant="secondary" onClick={() => load({ force: true })} disabled={loading} title="Tải lại">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>

            <Button variant="ghost" onClick={exportCSV} title="Xuất CSV" disabled={!data.items?.length}>
              <Download className="h-4 w-4 mr-1" />
              Xuất CSV
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <div>Tổng giao dịch: <b className="text-slate-800">{fmt.format(Number(data.total || 0))}</b></div>
          <div>Tổng tiền (trang hiện tại): <b className="text-emerald-700">{formatVND((data.items || []).reduce((a, b) => a + Number(b.amount || 0), 0))}</b></div>
          {Number(data.sum_amount) > 0 && (
            <div>Tổng tiền (theo bộ lọc): <b className="text-emerald-700">{formatVND(data.sum_amount)}</b></div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Đang tải…</div>
        ) : !data.items?.length ? (
          <Empty title="Không có giao dịch" subtitle="Hãy thay đổi bộ lọc hoặc thử làm mới." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Người trả</th>
                    <th className="px-3 py-2">Chiến dịch</th>
                    <th className="px-3 py-2">Số tiền</th>
                    <th className="px-3 py-2">Phương thức</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2 w-[280px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-emerald-50/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-800">{p.id}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.payer_name || p.payer_id || "—"}</span>
                          {p.payer_id ? (
                            <Button variant="ghost" size="sm" title="Copy payer_id" onClick={() => copy(p.payer_id, t)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {p.campaign_title || p.campaign_id || "—"}
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatVND(p.amount)}</td>
                      <td className="px-3 py-2"><MethodPill value={p.method} /></td>
                      <td className="px-3 py-2"><StatusBadge value={p.status} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => openDetail(p)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Chi tiết
                          </Button>

                          {p.status === "pending" && (
                            <Button onClick={() => patch(p.id, "success", "Xác nhận đánh dấu giao dịch này THÀNH CÔNG?")}>
                              <Check className="h-4 w-4 mr-1" />
                              Mark success
                            </Button>
                          )}

                          {p.status === "success" && (
                            <Button variant="ghost" onClick={() => patch(p.id, "refunded", "Thực hiện đánh dấu HOÀN TIỀN?")}>
                              <RotateCw className="h-4 w-4 mr-1" />
                              Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3 bg-white">
              <div className="text-sm text-slate-600">
                Trang <span className="font-medium text-slate-800">{data.page}</span> / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => { const p = clamp(data.page - 1, 1, totalPages); if (p !== data.page) setPage(p); }}
                  disabled={data.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Trước
                </Button>
                <Button
                  onClick={() => { const p = clamp(data.page + 1, 1, totalPages); if (p !== data.page) setPage(p); }}
                  disabled={data.page >= totalPages}
                >
                  Sau <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Detail Modal */}
      {detail && (
        <DetailModal
          loading={loadingDetail}
          payment={detail}
          onClose={() => setDetail(null)}
          onCopy={(v) => copy(v, t)}
        />
      )}
    </div>
  );
}

/* ============== Detail Modal ============== */
function DetailModal({ payment, onClose, onCopy, loading }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = payment || {};

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-[min(92vw,860px)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 border-b flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold">Chi tiết giao dịch #{p.id}</div>
            <div className="text-sm text-slate-500">{formatDateTime(p.created_at)} • <StatusBadge value={p.status} /></div>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="font-medium mb-2">Thông tin chính</div>
            <div className="space-y-2 text-sm">
              <Row label="Số tiền" value={formatVND(p.amount)} />
              <Row label="Phương thức" value={<MethodPill value={p.method} />} />
              <Row label="Chiến dịch" value={p.campaign_title || p.campaign_id || "—"} />
              <Row label="Người trả" value={p.payer_name || p.payer_id || "—"} />
              <Row label="Mã tham chiếu" value={p.reference || "—"} copy />
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-medium mb-2">Metadata</div>
            {loading ? (
              <div className="text-sm text-slate-500">Đang tải chi tiết…</div>
            ) : (
              <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-auto max-h-64">
                {JSON.stringify(p.metadata || p.raw || p, null, 2)}
              </pre>
            )}
          </Card>
        </div>

        <div className="p-4 border-t text-xs text-slate-500">
          Nếu bạn tích hợp webhook cổng thanh toán, hãy chắc chắn endpoint admin cập nhật đúng trạng thái (success/failed/refunded).
        </div>
      </div>
    </div>
  );

  function Row({ label, value, copy }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="text-slate-500">{label}</div>
        <div className="flex items-center gap-2">
          <div className="text-slate-800">{value}</div>
          {copy && (
            <Button variant="ghost" size="sm" onClick={() => onCopy?.(typeof value === "string" ? value : p.reference)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }
}
