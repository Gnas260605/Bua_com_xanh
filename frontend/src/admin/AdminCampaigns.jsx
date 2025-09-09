// src/admin/AdminCampaigns.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { apiGet, API_BASE } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  Search,
  Plus,
  Edit3,
  Archive,
  Image as ImageIcon,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";

/* ============== Helpers (UI) ============== */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const formatVND = (n) => (Number(n || 0)).toLocaleString("vi-VN") + "đ";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp (draft)" },
  { value: "active", label: "Đang chạy (active)" },
  { value: "archived", label: "Lưu trữ (archived)" },
];

function StatusBadge({ value }) {
  const map = {
    draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    archived: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  const label = value === "active" ? "active" : value === "archived" ? "archived" : "draft";
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[value || "draft"]}`}>
      {label}
    </span>
  );
}

function LinearProgress({ value, max }) {
  const pct = clamp(max ? (Number(value || 0) / Number(max || 0)) * 100 : 0, 0, 100);
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ============== Helpers (Network/Lỗi) ============== */
async function parseErrorResponse(r) {
  const status = r.status;
  const statusText = r.statusText || "";
  let msg = "";
  let payload = null;

  try {
    payload = await r.clone().json();
    msg = payload?.message || payload?.error || payload?.errors || "";
  } catch {
    try { msg = await r.clone().text(); } catch {}
  }

  if (status === 401) msg ||= "Phiên đăng nhập đã hết hạn hoặc thiếu quyền (401).";
  if (status === 403) msg ||= "Bạn không có quyền thực hiện thao tác này (403).";
  if (status === 404) msg ||= "API không tồn tại hoặc tài nguyên không tìm thấy (404).";
  if (status === 413) msg ||= "Tệp quá lớn (413).";
  if (status === 422) {
    if (payload?.errors && typeof payload.errors === "object") {
      const lines = [];
      for (const [field, val] of Object.entries(payload.errors)) {
        lines.push(`${field}: ${Array.isArray(val) ? val.join(", ") : String(val)}`);
      }
      msg = lines.length ? `Dữ liệu không hợp lệ:\n- ${lines.join("\n- ")}` : (msg || "Dữ liệu không hợp lệ (422).");
    } else msg ||= "Dữ liệu không hợp lệ (422).";
  }

  return `${status} ${statusText} – ${msg || `Yêu cầu thất bại (${status}).`}`.trim();
}

/** Upload dataURL -> URL */
async function uploadDataUrl(dataUrl, token) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const fd = new FormData();
  const filename = `cover-${Date.now()}.${(blob.type || "image/jpeg").split("/")[1] || "jpg"}`;
  fd.append("file", new File([blob], filename, { type: blob.type || "image/jpeg" }));
  fd.append("folder", "campaigns");

  const up = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  if (!up.ok) throw new Error(await parseErrorResponse(up));

  let resp;
  try { resp = await up.json(); }
  catch {
    const txt = await up.text();
    try { resp = JSON.parse(txt); } catch { resp = null; }
  }
  const url = resp?.url || resp?.data?.url;
  if (!url) throw new Error("Upload ảnh thành công nhưng không nhận được URL trả về.");
  return url;
}

/* ============== Chuẩn hoá dữ liệu từ API ============== */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((c) => ({
    ...c,
    cover_url: c.cover_url ?? c.cover ?? "",
    target_amount: c.target_amount ?? c.goal ?? 0,
    raised_amount: c.raised_amount ?? c.raised ?? 0,
    status: c.status ?? "draft",
    title: c.title ?? "",
    description: c.description ?? "",
  }));
}
function normalizeResponse(res, fallback = {}) {
  const base = res?.items ? res : (res?.data?.items ? res.data : fallback);
  const items = normalizeItems(base.items || []);
  const total = base.total != null ? Number(base.total) : (items.length || 0);
  const page = Number(base.page || fallback.page || 1);
  const pageSize = Number(base.pageSize || fallback.pageSize || 10);
  return { items, total, page, pageSize };
}

/* ============== Main Component ============== */
export default function AdminCampaigns() {
  const t = useToast();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // load list (gọi đúng /api/admin/campaigns)
  async function load({ gotoPage, force } = {}) {
    const nextPage = gotoPage ?? page;
    if (gotoPage) setPage(gotoPage);
    setLoading(true);
    try {
      const nonce = force ? `&_=${Date.now()}` : "";
      const url = `/api/admin/campaigns?q=${encodeURIComponent(debouncedQ)}&status=${encodeURIComponent(status)}&page=${nextPage}&pageSize=${pageSize}${nonce}`;
      const res = await apiGet(url);
      setData(normalizeResponse(res, { items: [], total: 0, page: nextPage, pageSize }));
    } catch (e) {
      console.error(e);
      setData({ items: [], total: 0, page: nextPage, pageSize });
      t.error(
        e?.message?.startsWith?.("TypeError")
          ? "Không kết nối được server. Kiểm tra API/CORS."
          : e?.message || "Không tải được danh sách chiến dịch."
      );
    } finally {
      setLoading(false);
    }
  }

  // gọi 1 lần khi mount để chắc chắn có request
  useEffect(() => { load({ force: true }); /* eslint-disable-next-line */ }, []);
  // và gọi khi filter/paging thay đổi
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [debouncedQ, status, page, pageSize]);

  // create / update
  async function save(item) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const isNew = !item?.id;
    setSaving(true);
    try {
      if (!item.title?.trim()) throw new Error("Vui lòng nhập tiêu đề chiến dịch.");
      if (item.target_amount == null || Number.isNaN(Number(item.target_amount)))
        throw new Error("Mục tiêu gây quỹ không hợp lệ.");
      if (Number(item.target_amount) < 0) throw new Error("Mục tiêu không thể âm.");

      let cover_url = item.cover_url || "";
      if (cover_url.startsWith("data:")) cover_url = await uploadDataUrl(cover_url, token);

      const r = await fetch(`${API_BASE}/api/admin/campaigns${isNew ? "" : `/${item.id}`}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...item, cover_url }),
      });
      if (!r.ok) throw new Error(await parseErrorResponse(r));

      t.success(isNew ? "🎉 Đã tạo chiến dịch" : "✅ Đã cập nhật chiến dịch");
      setEditing(null);
      await load({ gotoPage: 1, force: true });
    } catch (e) {
      console.error(e);
      t.error(e?.message || "Lỗi không xác định khi lưu chiến dịch.");
    } finally {
      setSaving(false);
    }
  }

  // archive (soft delete)
  async function archive(id) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    if (!confirm("Chuyển chiến dịch sang archived?")) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/campaigns/${id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error(await parseErrorResponse(r));
      t.info("Đã lưu trữ (archived)");
      load({ force: true });
    } catch (e) {
      t.error(e?.message || "Không lưu trữ được chiến dịch.");
    }
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditing({ title: "", description: "", cover_url: "", status: "draft", target_amount: 0, raised_amount: 0 });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        load({ force: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(data.total || 0) / Number(pageSize || 10))),
    [data.total, pageSize]
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Tìm theo tiêu đề/mô tả…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>

          <select
            className="input md:w-56"
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 md:ml-auto">
            <label className="text-sm text-slate-600">Hiển thị</label>
            <select
              className="input w-[90px]"
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
            >
              {[10, 20, 50].map((n) => (<option key={n} value={n}>{n}/trang</option>))}
            </select>

            <Button variant="secondary" onClick={() => load({ force: true })} disabled={loading} title="Tải lại">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>

            <Button onClick={() => setEditing({ title: "", description: "", cover_url: "", status: "draft", target_amount: 0, raised_amount: 0 })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo chiến dịch
            </Button>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-500">Tổng: {Number(data.total || 0)}</div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2 w-16">Cover</th>
                <th className="px-3 py-2 min-w-[260px]">Tiêu đề</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Mục tiêu</th>
                <th className="px-3 py-2">Đã gây quỹ</th>
                <th className="px-3 py-2 w-[230px]">Tiến độ</th>
                <th className="px-3 py-2 w-44">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-3"><div className="h-10 w-14 rounded-md bg-slate-100 animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-48 bg-slate-100 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-2 w-full bg-slate-100 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-28 bg-slate-100 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : !Array.isArray(data.items) || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8">
                    <Empty
                      title="Chưa có chiến dịch"
                      subtitle="Hãy tạo chiến dịch đầu tiên để bắt đầu gây quỹ."
                      action={
                        <Button onClick={() => setEditing({ title: "", description: "", cover_url: "", status: "draft", target_amount: 0, raised_amount: 0 })}>
                          <Plus className="h-4 w-4 mr-1.5" />
                          Tạo chiến dịch
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                data.items.map((c) => {
                  const target = Number(c.target_amount || 0);
                  const raised = Number(c.raised_amount || 0);
                  return (
                    <tr key={c.id} className="border-t hover:bg-emerald-50/30 transition-colors">
                      <td className="px-3 py-2">
                        {c.cover_url ? (
                          <img
                            src={c.cover_url}
                            alt=""
                            className="h-10 w-14 object-cover rounded-md ring-1 ring-slate-200"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        ) : (
                          <div className="h-10 w-14 rounded-md bg-slate-100 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800 line-clamp-1">{c.title}</div>
                        {c.description ? (
                          <div className="text-xs text-slate-500 line-clamp-1">{c.description}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2"><StatusBadge value={c.status} /></td>
                      <td className="px-3 py-2">{formatVND(target)}</td>
                      <td className="px-3 py-2">{formatVND(raised)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <LinearProgress value={raised} max={target || 1} />
                          <span className="text-xs text-slate-500 w-14 text-right">
                            {target ? Math.round((raised / target) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => setEditing(c)}>
                            <Edit3 className="h-4 w-4 mr-1" />
                            Sửa
                          </Button>
                          <Button variant="ghost" onClick={() => archive(c.id)}>
                            <Archive className="h-4 w-4 mr-1" />
                            Lưu trữ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && Array.isArray(data.items) && data.items.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-white">
            <div className="text-sm text-slate-600">
              Trang <span className="font-medium text-slate-800">{page}</span> / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => { const p = clamp(page - 1, 1, totalPages); if (p !== page) setPage(p); }}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Trước
              </Button>
              <Button
                onClick={() => { const p = clamp(page + 1, 1, totalPages); if (p !== page) setPage(p); }}
                disabled={page >= totalPages}
              >
                Sau <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <EditorForm
            value={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={save}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

/* ============== Modal ============== */
function Modal({ children, onClose }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-[min(92vw,720px)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {children}
      </div>
    </div>
  );
}

/* ============== Editor Form ============== */
function EditorForm({ value, onChange, onCancel, onSave, saving }) {
  const isNew = !value?.id;

  // paste ảnh từ clipboard → tự fill vào cover_url
  useEffect(() => {
    function onPaste(e) {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange({ ...value, cover_url: reader.result });
      reader.readAsDataURL(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [value, onChange]);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">{isNew ? "Tạo chiến dịch" : "Sửa chiến dịch"}</div>
          <div className="text-sm text-slate-500">Điền thông tin rõ ràng để người ủng hộ hiểu mục tiêu.</div>
        </div>
        <Button variant="ghost" onClick={onCancel}><X className="h-5 w-5" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 space-y-3">
          <input
            className="input w-full"
            placeholder="Tiêu đề chiến dịch"
            value={value.title || ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
          <textarea
            className="input w-full min-h-32"
            placeholder="Mô tả ngắn gọn, truyền cảm hứng…"
            value={value.description || ""}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Mục tiêu (VND)"
              value={value.target_amount ?? 0}
              onChange={(e) => onChange({ ...value, target_amount: Number(e.target.value) })}
            />
            <select
              className="input"
              value={value.status || "draft"}
              onChange={(e) => onChange({ ...value, status: e.target.value })}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          <input
            className="input w-full"
            placeholder="Ảnh cover URL (dán URL hoặc data:image/…;base64,…) "
            value={value.cover_url || ""}
            onChange={(e) => onChange({ ...value, cover_url: e.target.value })}
          />
          <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden bg-slate-50 aspect-[3/2] flex items-center justify-center">
            {value.cover_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={value.cover_url}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">Paste ảnh trực tiếp từ clipboard để điền nhanh</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Gợi ý: Ảnh tỷ lệ 3:2, tối thiểu 1200×800. Có thể dán trực tiếp <code>data:image/…;base64,…</code>, hệ thống tự upload khi bấm Lưu.
          </div>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Đóng</Button>
        <Button onClick={() => onSave(value)} disabled={saving}>
          {saving ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang lưu…</>) : (<><Check className="h-4 w-4 mr-1" /> Lưu</>)}
        </Button>
      </div>
    </div>
  );
}
