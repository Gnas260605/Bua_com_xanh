// src/pages/Delivery.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import {
  Truck, MapPin, ClipboardList, Send, Loader2, XCircle, CheckCircle2,
  Clock3, Navigation, PackageOpen, RefreshCcw, PencilLine, Filter,
  Search, ChevronLeft, ChevronRight, PauseCircle, PlayCircle
} from "lucide-react";

/* ================= UI primitives ================= */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_#e5e7eb,0_10px_28px_rgba(0,0,0,0.06)] ${className}`}>
    {children}
  </div>
);

const Pill = ({ children, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
    {children}
  </span>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400",
      "focus:outline-none focus:ring-2 focus:ring-emerald-300",
      props.className || "",
    ].join(" ")}
  />
);

const statusStyle = {
  pending:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  cancelled:"bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  completed:"bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  expired:  "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};
const statusDict = {
  pending: "Chờ duyệt", accepted: "Đã nhận", rejected: "Từ chối",
  cancelled: "Đã hủy", completed: "Hoàn tất", expired: "Hết hạn",
};
const StatusBadge = ({ status }) => (
  <Pill className={statusStyle[status] || statusStyle.cancelled}>
    {status === "accepted" || status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
     status === "pending" ? <Clock3 className="h-3.5 w-3.5" /> :
     <XCircle className="h-3.5 w-3.5" />}
    {statusDict[status] || status}
  </Pill>
);

/* Progress stepper (Grab-like) */
const STEPS = ["pending","accepted","completed"];
const Stepper = ({ status }) => {
  const getIdx = (s) => {
    if (s === "rejected" || s === "cancelled" || s === "expired") return -1;
    return Math.max(0, STEPS.indexOf(s));
  };
  const idx = getIdx(status);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = idx >= i;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-600" : "bg-slate-300"}`} />
            {i < STEPS.length - 1 && (
              <div className={`h-[2px] w-8 ${idx > i ? "bg-emerald-600" : "bg-slate-300"}`} />
            )}
          </div>
        );
      })}
      {idx < 0 && <span className="text-xs text-rose-600 font-medium">Đã dừng</span>}
    </div>
  );
};

/* ================= Helpers ================= */
const toVNDateTime = (ts) => new Date(ts || Date.now()).toLocaleString("vi-VN");

/* ================= Page ================= */
export default function Delivery() {
  // Form tạo booking
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("pickup"); // 'pickup' | 'meet' | 'delivery'
  const [pickupId, setPickupId] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  // Dữ liệu
  const [pickupPoints, setPickupPoints] = useState(null);
  const [bookings, setBookings] = useState(null);

  // Lọc & trang
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [editMethod, setEditMethod] = useState("pickup");
  const [editPickupId, setEditPickupId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshRef = useRef(null);

  /* ---------- Loaders ---------- */
  async function loadPickupPoints() {
    try {
      const r = await apiGet("/api/donor/pickup-points");
      setPickupPoints(r?.items || []);
    } catch {
      const s = await apiGet("/api/site-settings?key=pickup_points").catch(() => null);
      const arr = Array.isArray(s?.value) ? s.value : [];
      setPickupPoints(arr);
    }
  }

  async function loadBookings(opts = {}) {
    const { toPage = page } = opts;
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(toPage));
      sp.set("pageSize", String(pageSize));
      if (statusFilter) sp.set("status", statusFilter);
      if (q.trim()) sp.set("q", q.trim());

      // Backend trả {items, total} hoặc raw array
      const r = await apiGet(`/api/bookings?${sp.toString()}`);
      if (Array.isArray(r)) {
        setBookings(r);
        setTotal(r.length < pageSize ? r.length : toPage * pageSize + 1); // guessy
      } else {
        setBookings(r?.items || []);
        setTotal(r?.total || 0);
      }
      setPage(toPage);
    } catch {
      setBookings([]);
      setTotal(0);
    }
  }

  useEffect(() => { loadPickupPoints(); }, []);
  useEffect(() => { loadBookings({ toPage: 1 }); /* reset về trang 1 khi đổi filter */ }, [statusFilter]);

  // Auto refresh mỗi 15s
  useEffect(() => {
    if (!autoRefresh) {
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }
    refreshRef.current = setInterval(() => loadBookings({ toPage: page }), 15000);
    return () => refreshRef.current && clearInterval(refreshRef.current);
  }, [autoRefresh, page, q, statusFilter]); // ràng buộc

  /* ---------- Actions ---------- */
  async function createBooking(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        qty: Number(qty || 0),
        method,
        pickup_point: method === "pickup" ? (pickupId || null) : null,
        note: note || null,
      };
      await apiPost("/api/bookings", payload);
      setQty(1); setMethod("pickup"); setPickupId(""); setNote("");
      await loadBookings({ toPage: 1 });
    } finally {
      setCreating(false);
    }
  }

  async function cancelBooking(b) {
    try {
      await apiPatch(`/api/bookings/${b.id}`, { status: "cancelled" });
    } catch {
      await apiPost(`/api/bookings/${b.id}/cancel`, {});
    }
    await loadBookings({ toPage: page });
  }

  function startEdit(b) {
    setEditingId(b.id);
    setEditQty(b.qty || 1);
    setEditMethod(b.method || "pickup");
    setEditPickupId(b.pickup_point || "");
    setEditNote(b.note || "");
  }
  function stopEdit() {
    setEditingId(null);
    setSavingEdit(false);
  }
  async function saveEdit() {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      const body = {
        qty: Number(editQty || 1),
        method: editMethod,
        pickup_point: editMethod === "pickup" ? (editPickupId || null) : null,
        note: editNote || null,
      };
      await apiPatch(`/api/bookings/${editingId}`, body);
      stopEdit();
      await loadBookings({ toPage: page });
    } finally {
      setSavingEdit(false);
    }
  }

  /* ---------- Derived ---------- */
  const visibleBookings = useMemo(() => {
    const arr = Array.isArray(bookings) ? bookings : [];
    const kw = q.trim().toLowerCase();
    if (!kw) return arr;
    return arr.filter(b =>
      (b.note || "").toLowerCase().includes(kw) ||
      (b.status || "").toLowerCase().includes(kw) ||
      String(b.qty || "").includes(kw)
    );
  }, [bookings, q]);

  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  /* ================= Render ================= */
  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Hero */}
      <div className="rounded-3xl p-5 mb-6 bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500 text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
        <div className="flex flex-wrap items-center gap-3">
          <Truck className="h-8 w-8" />
          <h1 className="text-3xl font-extrabold tracking-tight">Đặt — Nhận</h1>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => loadBookings({ toPage: page })}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
              title="Làm mới"
            >
              <RefreshCcw className="h-4 w-4" /> Làm mới
            </button>

            <button
              onClick={() => setAutoRefresh(v => !v)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm"
              title={autoRefresh ? "Tắt tự làm mới" : "Bật tự làm mới"}
            >
              {autoRefresh ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              {autoRefresh ? "Đang tự làm mới" : "Tự làm mới"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-white/90">Tạo yêu cầu nhận cơm và theo dõi trạng thái xử lý theo thời gian thực.</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(340px,1fr)_minmax(420px,1.2fr)] gap-6">
        {/* Left: Tạo đơn */}
        <div className="space-y-4">
          <Card>
            <form onSubmit={createBooking} className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-900">
                <ClipboardList className="h-5 w-5 text-emerald-700" />
                <div className="font-semibold">Tạo yêu cầu nhận đồ ăn</div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-800">Số suất</span>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-800">Hình thức</span>
                  <div className="flex rounded-xl border overflow-hidden">
                    {["pickup","meet","delivery"].map(m => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setMethod(m)}
                        className={[
                          "flex-1 py-2.5 text-sm font-semibold transition-colors",
                          method === m ? "bg-emerald-600 text-white" : "bg-white hover:bg-slate-50"
                        ].join(" ")}
                      >
                        {m === "pickup" ? "Tự đến điểm" : m === "meet" ? "Hẹn gặp" : "Giao tận nơi"}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              {method === "pickup" && (
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-slate-800">Điểm giao nhận</span>
                  {!pickupPoints ? (
                    <div className="px-4 py-2.5 rounded-xl border text-slate-600">Đang tải điểm…</div>
                  ) : pickupPoints.length === 0 ? (
                    <div className="px-4 py-2.5 rounded-xl border text-slate-600">Chưa có điểm nào.</div>
                  ) : (
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        <select
                          value={pickupId}
                          onChange={(e) => setPickupId(e.target.value)}
                          className="flex-1 outline-none bg-transparent"
                        >
                          <option value="">— Chọn điểm —</option>
                          {pickupPoints.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.address}
                            </option>
                          ))}
                        </select>
                      </div>
                      {pickupId && (
                        <a
                          href={(() => {
                            const found = pickupPoints.find(p => String(p.id) === String(pickupId));
                            if (!found) return "#";
                            return found.lat && found.lng
                              ? `https://www.google.com/maps/search/?api=1&query=${found.lat},${found.lng}`
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(found.address || found.name)}`;
                          })()}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Mở bản đồ
                        </a>
                      )}
                    </div>
                  )}
                </label>
              )}

              <label className="grid gap-1">
                <span className="text-sm font-medium text-slate-800">Ghi chú</span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="Ví dụ: nhà có người già, vui lòng gọi trước…"
                />
              </label>

              <div className="text-right">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-4 py-2.5 font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-60"
                  disabled={creating || (method === "pickup" && !pickupId)}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gửi yêu cầu
                </button>
              </div>
            </form>
          </Card>

          {/* Bộ lọc (Grab-like toolbar) */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border px-3 py-1.5 bg-white">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadBookings({ toPage: 1 })}
                  placeholder="Tìm theo ghi chú / trạng thái / số suất… (Enter)"
                  className="outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border px-3 py-1.5 bg-white">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  className="bg-transparent outline-none text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="accepted">Đã nhận</option>
                  <option value="rejected">Từ chối</option>
                  <option value="cancelled">Đã hủy</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="expired">Hết hạn</option>
                </select>
              </div>

              <button
                onClick={() => loadBookings({ toPage: 1 })}
                className="inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm bg-white hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" /> Áp dụng
              </button>

              {(q || statusFilter) && (
                <button
                  onClick={() => { setQ(""); setStatusFilter(""); loadBookings({ toPage: 1 }); }}
                  className="ml-auto text-sm text-slate-600 hover:underline"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Danh sách đơn */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="px-1 pb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-700" />
              <div className="font-semibold">Đơn của bạn</div>
              <div className="ml-auto text-xs text-slate-500">{total} đơn</div>
            </div>

            {!bookings ? (
              <div className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/3" />
              </div>
            ) : (visibleBookings.length === 0 ? (
              <div className="p-8 text-center text-slate-600">Chưa có yêu cầu nào.</div>
            ) : (
              <>
                <div className="grid gap-3">
                  {visibleBookings.map(b => {
                    const isEditing = editingId === b.id;
                    const showMapLink =
                      !isEditing && b.method === "pickup" && b.pickup_point &&
                      (pickupPoints || []).some(p => String(p.id) === String(b.pickup_point));
                    const point = showMapLink
                      ? (pickupPoints || []).find(p => String(p.id) === String(b.pickup_point))
                      : null;

                    return (
                      <div key={b.id} className="p-3 rounded-2xl border bg-white hover:shadow-[0_1px_0_#e5e7eb,0_12px_28px_rgba(0,0,0,0.08)] transition-all">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200">
                            <ClipboardList className="h-6 w-6 text-emerald-700" />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Header line */}
                            <div className="flex flex-wrap items-center gap-2">
                              {isEditing ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input
                                    type="number" min={1}
                                    value={editQty}
                                    onChange={(e)=>setEditQty(e.target.value)}
                                    className="w-24"
                                  />
                                  <div className="flex rounded-xl border overflow-hidden">
                                    {["pickup","meet","delivery"].map(m => (
                                      <button
                                        key={m} type="button"
                                        onClick={() => setEditMethod(m)}
                                        className={[
                                          "px-3 py-1.5 text-xs font-semibold",
                                          editMethod === m ? "bg-emerald-600 text-white" : "bg-white hover:bg-slate-50"
                                        ].join(" ")}
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                  {editMethod === "pickup" && (
                                    <select
                                      value={editPickupId}
                                      onChange={(e)=>setEditPickupId(e.target.value)}
                                      className="rounded-xl border px-3 py-1.5 text-xs"
                                    >
                                      <option value="">— Chọn điểm —</option>
                                      {(pickupPoints||[]).map(p => (
                                        <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ) : (
                                <div className="font-semibold text-slate-900">
                                  Nhận {b.qty || 1} suất • {b.method === "pickup" ? "Tự đến điểm" : b.method === "meet" ? "Hẹn gặp" : "Giao tận nơi"}
                                </div>
                              )}
                              <StatusBadge status={b.status} />
                            </div>

                            {/* Stepper */}
                            <div className="mt-2">
                              <Stepper status={b.status} />
                            </div>

                            {/* Note + time + map */}
                            <div className="mt-2 space-y-1">
                              {isEditing ? (
                                <textarea
                                  rows={2}
                                  value={editNote}
                                  onChange={(e)=>setEditNote(e.target.value)}
                                  className="w-full rounded-xl border px-3 py-2 text-sm"
                                  placeholder="Ghi chú…"
                                />
                              ) : (
                                b.note && <div className="text-sm text-slate-600 line-clamp-2">{b.note}</div>
                              )}

                              <div className="text-xs text-slate-500">
                                {toVNDateTime(b.created_at || b.updated_at)}
                              </div>

                              {showMapLink && point && (
                                <a
                                  href={point.lat && point.lng
                                    ? `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.address || point.name)}`}
                                  target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                                >
                                  <Navigation className="h-3.5 w-3.5" /> Bản đồ điểm nhận: {point.name}
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            {!isEditing ? (
                              <>
                                {b.status === "pending" && (
                                  <button
                                    onClick={() => startEdit(b)}
                                    className="px-3 py-1.5 rounded-2xl border text-sm hover:bg-slate-50 inline-flex items-center gap-1"
                                    title="Sửa số suất / hình thức / ghi chú"
                                  >
                                    <PencilLine className="h-4 w-4" /> Sửa
                                  </button>
                                )}
                                {b.status === "pending" && (
                                  <button
                                    onClick={() => cancelBooking(b)}
                                    className="px-3 py-1.5 rounded-2xl border text-sm hover:bg-rose-50"
                                  >
                                    Hủy
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={saveEdit}
                                  disabled={savingEdit || (editMethod === "pickup" && !editPickupId)}
                                  className="px-3 py-1.5 rounded-2xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {savingEdit ? "Đang lưu…" : "Lưu"}
                                </button>
                                <button
                                  onClick={stopEdit}
                                  className="px-3 py-1.5 rounded-2xl border text-sm hover:bg-slate-50"
                                >
                                  Hủy bỏ
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Trang <span className="font-semibold">{page}</span> / {Math.max(1, Math.ceil(total / pageSize))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!canPrev}
                      onClick={() => canPrev && loadBookings({ toPage: page - 1 })}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4" /> Trước
                    </button>
                    <button
                      disabled={!canNext}
                      onClick={() => canNext && loadBookings({ toPage: page + 1 })}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
                    >
                      Sau <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ))}
          </Card>

          {/* Mẹo nhỏ */}
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-sky-50 border border-sky-200">
                <PackageOpen className="h-5 w-5 text-sky-700" />
              </div>
              <div className="text-sm text-slate-700 leading-relaxed">
                • Trạng thái <b>Chờ duyệt → Đã nhận → Hoàn tất</b> hiển thị như “thanh tiến trình”.<br/>
                • Bạn có thể <b>sửa</b> hoặc <b>hủy</b> khi đơn còn “Chờ duyệt”.<br/>
                • Bật <b>Tự làm mới</b> để cập nhật theo thời gian thực giống Grab.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
