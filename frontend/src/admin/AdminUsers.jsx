// src/pages/AdminUsers.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPatch, apiDelete } from "../lib/api";
import {
  Search, RefreshCcw, Crown, Loader2, Mail, Shield,
  ShieldQuestion, Filter, Edit3, Trash2, Ban, Unlock,
  FileSearch, UserCog, Check, X
} from "lucide-react";
import { useToast } from "../components/ui/Toast";

const ROLE_OPTIONS = ["all", "user", "donor", "receiver", "shipper", "admin"];
const STATUS_OPTIONS = ["all", "active", "banned", "deleted"];
const EXTRA_ROLES = ["donor", "receiver", "shipper"]; // dùng bảng user_roles

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  const [selected, setSelected] = useState([]); // ids
  const [editU, setEditU] = useState(null);     // object | null
  const [logU, setLogU] = useState(null);       // user for audit log
  const [logs, setLogs] = useState([]);         // audit rows
  const [logsLoading, setLogsLoading] = useState(false);

  const deb = useRef(null);
  const prevTotals = useRef({ total: 0 });
  const t = useToast();

  async function load(page = 1, pageSize = data.pageSize, silent = false) {
    try {
      if (!silent) {
        setLoading(true);
        t.info("Đang tải danh sách người dùng…");
      }
      setErr("");
      const qs = new URLSearchParams({
        q,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (role !== "all") qs.set("role", role);
      if (status !== "all") qs.set("status", status);

      const res = await apiGet(`/api/admin/users?${qs.toString()}`);
      setData({ ...res, page, pageSize });
      setSelected([]);

      if (!silent) {
        const prev = prevTotals.current.total ?? 0;
        if (prev !== res.total) {
          const delta = res.total - prev;
          const arrow = delta > 0 ? `↑ +${delta}` : `↓ ${delta}`;
          t.success(`Đã tải ${res.total} người dùng (${arrow})`);
        } else {
          t.info("Dữ liệu người dùng đã là mới nhất");
        }
        prevTotals.current.total = res.total;
      }
    } catch (e) {
      const msg = e?.message || "Load users failed";
      setErr(msg);
      t.error(`Không tải được danh sách: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // initial
  useEffect(() => { load(1, data.pageSize); /* eslint-disable-next-line */ }, []);

  // debounce search + filters
  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(() => load(1, data.pageSize, true), 350);
    return () => clearTimeout(deb.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status]);

  const nf = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 10))),
    [data.total, data.pageSize]
  );
  const showingFrom = useMemo(
    () => (data.total ? (data.page - 1) * data.pageSize + 1 : 0),
    [data.page, data.pageSize, data.total]
  );
  const showingTo = useMemo(
    () => Math.min(data.total || 0, data.page * (data.pageSize || 10)),
    [data.page, data.pageSize, data.total]
  );

  function toggleSelectAll(checked) {
    if (checked) {
      setSelected(data.items.map((u) => u.id));
      t.info(`Đã chọn ${data.items.length} người dùng`);
    } else {
      setSelected([]);
      t.info("Bỏ chọn tất cả");
    }
  }
  function toggleOne(id) {
    setSelected((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      t.info(next.includes(id) ? "Đã chọn 1 người dùng" : "Đã bỏ chọn 1 người dùng");
      return next;
    });
  }

  async function setStatusOne(id, next) {
    if (!id) return;
    try {
      setRowBusy(id);
      t.info("Đang cập nhật trạng thái…");
      await apiPatch(`/api/admin/users/${id}`, { status: next });
      t.success(`Đã chuyển trạng thái sang "${next}"`);
      await load(data.page, data.pageSize, true);
    } catch (e) {
      t.error(e?.message || "Cập nhật trạng thái thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function deleteOne(id) {
    if (!id) return;
    if (!confirm("Xoá vĩnh viễn user này? Hành động không thể hoàn tác.")) return;
    try {
      setRowBusy(id);
      t.info("Đang xoá người dùng…");
      await apiDelete(`/api/admin/users/${id}`);
      t.success("Đã xoá người dùng");
      await load(data.page, data.pageSize, true);
    } catch (e) {
      t.error(e?.message || "Xoá thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function makeAdmin(id) {
    if (!confirm("Nâng quyền Admin cho người dùng này?")) return;
    try {
      setRowBusy(id);
      t.info("Đang nâng quyền Admin…");
      await apiPatch(`/api/admin/users/${id}`, { role: "admin" });
      t.success("Đã đặt vai trò chính thành Admin");
      await load(data.page, data.pageSize, true);
    } catch (e) {
      t.error(e?.message || "Nâng quyền thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function openLogs(u) {
    setLogU(u);
    setLogs([]);
    setLogsLoading(true);
    t.info("Đang tải audit log…");
    try {
      const res = await apiGet(`/api/admin/audit?userId=${encodeURIComponent(u.id)}&limit=30`);
      const rows = Array.isArray(res?.items) ? res.items : res;
      setLogs(rows);
      t.success(`Đã tải ${rows?.length ?? 0} dòng audit`);
    } catch (e) {
      const row = { id: "err", action: e?.message || "Load audit failed", created_at: new Date().toISOString() };
      setLogs([row]);
      t.error(e?.message || "Không tải được audit log");
    } finally {
      setLogsLoading(false);
    }
  }

  // bulk helpers (loop từng id để tương thích backend phổ biến)
  async function bulkStatus(next) {
    if (!selected.length) return;
    if (!confirm(`Áp dụng trạng thái "${next}" cho ${selected.length} user?`)) return;
    t.info(`Đang cập nhật trạng thái cho ${selected.length} user…`);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await apiPatch(`/api/admin/users/${id}`, { status: next }); ok++; } catch { fail++; }
    }
    await load(data.page, data.pageSize, true);
    if (fail === 0) t.success(`Đã cập nhật ${ok}/${selected.length} user`);
    else t.error(`Hoàn tất: ${ok} thành công, ${fail} lỗi`);
  }

  async function bulkDelete() {
    if (!selected.length) return;
    if (!confirm(`Xoá ${selected.length} user? Hành động không thể hoàn tác.`)) return;
    t.info(`Đang xoá ${selected.length} user…`);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await apiDelete(`/api/admin/users/${id}`); ok++; } catch { fail++; }
    }
    await load(1, data.pageSize, true);
    if (fail === 0) t.success(`Đã xoá ${ok}/${selected.length} user`);
    else t.error(`Hoàn tất: ${ok} thành công, ${fail} lỗi`);
  }

  return (
    <div className="space-y-5">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-gray-500">Danh sách người dùng + bộ lọc theo vai trò / trạng thái</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="Tìm tên / email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1, data.pageSize)}
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border bg-white p-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
              value={role}
              onChange={(e) => { setRole(e.target.value); t.info(`Lọc vai trò: ${e.target.value}`); }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r === "all" ? "Tất cả vai trò" : r}</option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
              value={status}
              onChange={(e) => { setStatus(e.target.value); t.info(`Lọc trạng thái: ${e.target.value}`); }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === "all" ? "Tất cả trạng thái" : s}</option>
              ))}
            </select>
          </div>

          <select
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
            value={data.pageSize}
            onChange={(e) => { t.info(`Đổi kích thước trang: ${e.target.value}/trang`); load(1, Number(e.target.value)); }}
          >
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
          </select>

          <button
            onClick={() => { setRefreshing(true); t.info("Đang làm mới…"); load(data.page, data.pageSize); }}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            disabled={refreshing || loading}
            title="Làm mới"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <a
            href="/admin/reports"
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            title="Xử lý báo cáo & khiếu nại"
            onClick={() => t.info("Đi tới trang Reports")}
          >
            <FileSearch className="h-4 w-4" />
            Reports
          </a>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Không tải được dữ liệu</div>
            <div className="text-sm opacity-90">{err}</div>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
          <span className="text-sm text-gray-500">Đã chọn {nf.format(selected.length)}</span>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => bulkStatus("banned")}
            title="Khoá (ban)"
          >
            <Ban className="mr-1 inline h-4 w-4" /> Khoá
          </button>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => bulkStatus("active")}
            title="Mở khoá"
          >
            <Unlock className="mr-1 inline h-4 w-4" /> Mở khoá
          </button>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-rose-50 border-rose-200 text-rose-700"
            onClick={bulkDelete}
            title="Xoá"
          >
            <Trash2 className="mr-1 inline h-4 w-4" /> Xoá
          </button>
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-2xl border bg-white shadow-sm">
        {loading && !data.items.length ? (
          <SkeletonTable />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.length === data.items.length && data.items.length > 0}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Extra roles</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const extras = normalizeExtras(u);
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.includes(u.id)}
                          onChange={() => toggleOne(u.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Avatar url={u.avatar_url} name={u.name || u.email} />
                          <div>
                            <div className="font-medium">{u.name || "—"}</div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Mail className="h-3.5 w-3.5" />
                              <a href={`mailto:${u.email}`} className="hover:underline">{u.email}</a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {EXTRA_ROLES.map((r) => (
                            <ToggleChip
                              key={r}
                              active={extras.includes(r)}
                              label={r}
                              onToggle={async (next) => {
                                try {
                                  setRowBusy(u.id);
                                  t.info(`Đang cập nhật vai trò phụ: ${r}…`);
                                  const nextExtras = next
                                    ? Array.from(new Set([...extras, r]))
                                    : extras.filter((x) => x !== r);
                                  await apiPatch(`/api/admin/users/${u.id}`, { extraRoles: nextExtras });
                                  t.success(`Đã ${next ? "bật" : "tắt"} vai trò "${r}"`);
                                  await load(data.page, data.pageSize, true);
                                } catch (e) {
                                  t.error(e?.message || "Cập nhật vai trò phụ thất bại");
                                } finally {
                                  setRowBusy(null);
                                }
                              }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.role !== "admin" && (
                            <BtnGhost onClick={() => makeAdmin(u.id)} title="Set Admin">
                              {rowBusy === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                              Admin
                            </BtnGhost>
                          )}
                          <BtnGhost onClick={() => { setEditU(u); t.info("Mở form chỉnh sửa người dùng"); }} title="Chỉnh sửa">
                            <Edit3 className="h-4 w-4" /> Edit
                          </BtnGhost>
                          {u.status !== "banned" ? (
                            <BtnGhost onClick={() => setStatusOne(u.id, "banned")} title="Khoá">
                              <Ban className="h-4 w-4" /> Khoá
                            </BtnGhost>
                          ) : (
                            <BtnGhost onClick={() => setStatusOne(u.id, "active")} title="Mở khoá">
                              <Unlock className="h-4 w-4" /> Mở
                            </BtnGhost>
                          )}
                          <BtnDanger onClick={() => deleteOne(u.id)} title="Xoá">
                            <Trash2 className="h-4 w-4" /> Xoá
                          </BtnDanger>
                          <BtnGhost onClick={() => openLogs(u)} title="Audit log">
                            <UserCog className="h-4 w-4" /> Log
                          </BtnGhost>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!data.items.length && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-500">
          Hiển thị {nf.format(showingFrom)}–{nf.format(showingTo)} / {nf.format(data.total)}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={data.page <= 1 || loading}
            onClick={() => { t.info("Trang trước"); load(data.page - 1); }}
          >Prev</button>
          <div className="min-w-[110px] text-center text-sm">
            Trang {nf.format(data.page)} / {nf.format(totalPages)}
          </div>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={data.page >= totalPages || loading}
            onClick={() => { t.info("Trang tiếp theo"); load(data.page + 1); }}
          >Next</button>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={!!editU} onClose={() => { setEditU(null); t.info("Đóng form chỉnh sửa"); }} title="Chỉnh sửa user">
        {editU && (
          <EditUserForm
            u={editU}
            onClose={() => { setEditU(null); t.info("Đóng form chỉnh sửa"); }}
            onSaved={async () => {
              setEditU(null);
              t.success("Đã lưu thay đổi người dùng");
              await load(data.page, data.pageSize, true);
            }}
          />
        )}
      </Modal>

      {/* Audit log modal */}
      <Modal open={!!logU} onClose={() => { setLogU(null); t.info("Đóng audit log"); }} title={`Audit log • ${logU?.name || logU?.email || ""}`}>
        {logsLoading ? (
          <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border bg-white p-3">
                <div className="text-sm font-medium">{l.action || "—"}</div>
                <div className="text-xs text-gray-500">
                  {l.entity ? `${l.entity}#${l.entity_id ?? ""} • ` : ""}
                  {formatTime(l.created_at)}
                </div>
                {l.meta && (
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-600">
                    {typeof l.meta === "string" ? l.meta : JSON.stringify(l.meta, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {!logs.length && <div className="text-sm text-gray-500">Không có log</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ==================== Subcomponents ==================== */

function Avatar({ url, name }) {
  const fallback = "https://i.pravatar.cc/64?img=12";
  return (
    <div className="h-9 w-9 overflow-hidden rounded-xl border">
      <img
        src={url || fallback}
        alt={name || "avatar"}
        className="h-full w-full object-cover"
        onError={(e) => { e.currentTarget.src = fallback; }}
      />
    </div>
  );
}

function RoleBadge({ role }) {
  if (!role) return <span className="text-xs text-gray-400">—</span>;
  const map = {
    admin: "border-amber-200 bg-amber-50 text-amber-800",
    donor: "border-blue-200 bg-blue-50 text-blue-700",
    receiver: "border-emerald-200 bg-emerald-50 text-emerald-700",
    shipper: "border-purple-200 bg-purple-50 text-purple-700",
    user: "border-gray-200 bg-gray-50 text-gray-600",
  };
  const cls = map[role] || map.user;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${cls}`}>
      {role === "admin" ? <Crown className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
      {role}
    </span>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const map = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    banned: "border-rose-200 bg-rose-50 text-rose-700",
    deleted: "border-gray-200 bg-gray-50 text-gray-600",
  };
  const cls = map[status] || "border-gray-200 bg-gray-50 text-gray-600";
  return <span className={`inline-block rounded-lg border px-2 py-1 text-xs ${cls}`}>{status}</span>;
}

function ToggleChip({ active, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition
        ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
      title={`Bật/tắt vai trò phụ: ${label}`}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function BtnGhost({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-gray-50"
    >
      {children}
    </button>
  );
}
function BtnDanger({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
    >
      {children}
    </button>
  );
}

function SkeletonTable() {
  return (
    <div className="p-3">
      <div className="mb-2 h-5 w-48 animate-pulse rounded bg-gray-200" />
      <div className="overflow-hidden rounded-xl border">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b p-3 last:border-0">
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-gray-200" />
            <div className="flex-1">
              <div className="mb-2 h-3 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-28 animate-pulse rounded bg-gray-100" />
            <div className="h-8 w-44 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50">Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditUserForm({ u, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: u.name || "",
    phone: u.phone || "",
    address: u.address || "",
    role: u.role || "user",
    status: u.status || "active",
    extraRoles: normalizeExtras(u),
  });
  const [saving, setSaving] = useState(false);
  const t = useToast();

  async function save() {
    try {
      setSaving(true);
      t.info("Đang lưu thay đổi…");
      await apiPatch(`/api/admin/users/${u.id}`, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        role: form.role,              // set role chính
        status: form.status,          // chỉnh sửa trạng thái
        extraRoles: form.extraRoles,  // set vai trò phụ
      });
      t.success("Đã lưu thay đổi");
      onSaved?.();
    } catch (e) {
      t.error(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function toggleExtra(r) {
    setForm((f) => {
      const has = f.extraRoles.includes(r);
      const next = has ? f.extraRoles.filter((x) => x !== r) : [...f.extraRoles, r];
      return { ...f, extraRoles: next };
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tên">
          <input className="input-like" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Số điện thoại">
          <input className="input-like" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Địa chỉ" className="sm:col-span-2">
          <input className="input-like" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Role chính">
          <select className="input-like" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.filter((r) => r !== "all").map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Trạng thái">
          <select className="input-like" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Vai trò phụ (user_roles)" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {EXTRA_ROLES.map((r) => (
              <ToggleChip key={r} active={form.extraRoles.includes(r)} label={r} onToggle={() => toggleExtra(r)} />
            ))}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50" onClick={onClose}>Huỷ</button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Lưu thay đổi
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-xs font-medium text-gray-600">{label}</div>
      {children}
    </label>
  );
}

/* ============= Utilities ============= */

function normalizeExtras(u) {
  // chấp nhận u.extraRoles | u.roles | u.user_roles dạng mảng
  const arr = Array.isArray(u?.extraRoles)
    ? u.extraRoles
    : Array.isArray(u?.roles)
    ? u.roles
    : Array.isArray(u?.user_roles)
    ? u.user_roles
    : [];
  return arr.filter((x) => EXTRA_ROLES.includes(x));
}

function formatTime(d) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}
