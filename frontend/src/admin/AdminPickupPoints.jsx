// src/pages/AdminPickupPoints.jsx
import { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

/* ======================= Helpers ======================= */
function authHeader() {
  const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiJSON(url, method = "GET", body) {
  const r = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await r.text().catch(() => "");
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || (typeof data === "string" ? data : "") || `API ${method} ${url} failed`;
    throw new Error(msg);
  }
  return data;
}

/** opening: accept string or JSON-string or object; return {mon..sun} | null */
function parseOpening(opening) {
  if (!opening) return null;
  if (typeof opening === "object" && opening !== null) return opening;
  if (typeof opening === "string") {
    try {
      const o = JSON.parse(opening);
      if (o && typeof o === "object") return o;
      return null;
    } catch {
      return null; // it's a plain string like "08:00–20:00, T2–CN"
    }
  }
  return null;
}

/** luôn trả về NULL hoặc JSON string hợp lệ (không bao giờ trả "" để tránh vi phạm ràng buộc DB) */
function normalizeOpeningForSave(opening) {
  if (opening == null) return null;
  if (typeof opening === "string") {
    const s = opening.trim();
    if (!s) return null;
    try { JSON.parse(s); return s; } catch { return s; }
  }
  try { return JSON.stringify(opening); } catch { return null; }
}

const DAY_LABEL = { mon: "Th 2", tue: "Th 3", wed: "Th 4", thu: "Th 5", fri: "Th 6", sat: "Th 7", sun: "CN" };

function formatOpening(opening) {
  if (!opening) return "-";
  if (typeof opening === "string") {
    try {
      const asObj = JSON.parse(opening);
      if (asObj && typeof asObj === "object") return formatOpening(asObj);
      return opening || "-";
    } catch { return opening || "-"; }
  }
  const parts = [];
  for (const k of ["mon","tue","wed","thu","fri","sat","sun"]) {
    const d = opening[k];
    if (!d || d.enabled === false) continue;
    const open = d.open || "";
    const close = d.close || "";
    if (!open || !close) continue;
    parts.push(`${DAY_LABEL[k]} ${open}–${close}`);
  }
  return parts.length ? parts.join("; ") : "-";
}
function defaultOpening() {
  const all = {};
  for (const k of ["mon","tue","wed","thu","fri","sat","sun"]) {
    all[k] = { enabled: true, open: "08:00", close: "20:00" };
  }
  return all;
}

/* ======================= Weekly editor ======================= */
function WeeklyHoursEditor({ value, onChange, readOnly }) {
  const v = value || defaultOpening();
  function setDay(k, patch) {
    onChange?.({ ...v, [k]: { ...v[k], ...patch } });
  }
  return (
    <div className="divide-y rounded-xl border bg-white">
      {["mon","tue","wed","thu","fri","sat","sun"].map((k, idx) => (
        <div key={k} className="flex items-center gap-3 p-2.5 hover:bg-slate-50">
          <div className="w-12 shrink-0 text-sm font-medium text-gray-700">{DAY_LABEL[k]}</div>
          {readOnly ? (
            <div className="text-sm">
              {v[k]?.enabled === false ? "Đóng cửa" :
               (v[k]?.open && v[k]?.close ? `${v[k].open}–${v[k].close}` : "-")}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-emerald-600"
                  checked={v[k]?.enabled !== false}
                  onChange={(e) => setDay(k, { enabled: e.target.checked })}
                />
                Mở
              </label>
              <input
                type="time"
                className="input w-28"
                disabled={v[k]?.enabled === false}
                value={v[k]?.open || ""}
                onChange={(e) => setDay(k, { open: e.target.value })}
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                className="input w-28"
                disabled={v[k]?.enabled === false}
                value={v[k]?.close || ""}
                onChange={(e) => setDay(k, { close: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ======================= Page ======================= */
export default function AdminPickupPoints() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("list"); // 'list' | 'tracking'
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // object | null
  const [mode, setMode] = useState("edit"); // 'edit' | 'view'
  const [loading, setLoading] = useState(true);

  // tracking
  const [deliveries, setDeliveries] = useState([]);
  const [shippers, setShippers] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const t = useToast();

  async function load() {
    try {
      setLoading(true);
      const res = await apiGet(`/api/admin/pickup-points?q=${encodeURIComponent(q)}`);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setItems([]);
      t.error(typeof e?.message === "string" ? e.message : "Không tải được danh sách điểm tập kết");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save(p) {
    const name = p?.name?.trim();
    const address = (p?.address ?? "").trim();
    const lat = p?.lat;
    const lng = p?.lng;

    if (!name) { t.error("Vui lòng nhập tên điểm tập kết"); return; }
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      t.error("Vui lòng nhập Lat/Lng hoặc dùng 'Lấy toạ độ'"); return;
    }

    const isNew = !p?.id;
    try {
      const openingVal = normalizeOpeningForSave(p?.opening);
      const payload = {
        name, address, lat: Number(lat), lng: Number(lng),
        opening: openingVal, // never ""
        status: p?.status || (p?.active ? "active" : "inactive"),
      };
      await apiJSON(`/api/admin/pickup-points${isNew ? "" : `/${p.id}`}`, isNew ? "POST" : "PATCH", payload);
      t.success(isNew ? "Đã tạo điểm tập kết" : "Đã cập nhật");
      setEditing(null);
      load();
    } catch (e) {
      t.error(typeof e?.message === "string" ? e.message : "Lỗi lưu điểm tập kết");
      console.error(e);
    }
  }

  async function removePoint(id) {
    if (!confirm("Xoá điểm hẹn này?")) return;
    try {
      await apiJSON(`/api/admin/pickup-points/${id}`, "DELETE");
      t.info("Đã xoá");
      load();
    } catch (e) {
      t.error(typeof e?.message === "string" ? e.message : "Không xoá được");
      console.error(e);
    }
  }

  function newPoint() {
    setMode("edit");
    setEditing({
      name: "",
      address: "",
      lat: 16.047079,
      lng: 108.20623,
      opening: defaultOpening(),
      status: "active",
    });
  }

  /* ======================= Tracking (map) ======================= */
  const { isLoaded: mapReady } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const center = useMemo(() => {
    const first = (items || []).find((x) => x.lat != null && x.lng != null);
    if (first) return { lat: Number(first.lat), lng: Number(first.lng) };
    return { lat: 16.047079, lng: 108.20623 };
  }, [items]);

  async function loadTracking() {
    try {
      setTrackingLoading(true);
      const [assigned, picking] = await Promise.all([
        apiGet("/api/admin/deliveries?status=assigned").catch(() => []),
        apiGet("/api/admin/deliveries?status=picking").catch(() => []),
      ]);
      const allDel = [
        ...(Array.isArray(assigned) ? assigned?.items || assigned : []),
        ...(Array.isArray(picking) ? picking?.items || picking : []),
      ];
      setDeliveries(allDel);

      const shipRes = await apiGet("/api/admin/users?role=shipper&pageSize=200").catch(() => ({ items: [] }));
      setShippers(Array.isArray(shipRes?.items) ? shipRes.items : []);
    } finally {
      setTrackingLoading(false);
    }
  }

  useEffect(() => { if (tab === "tracking") loadTracking(); /* eslint-disable-next-line */ }, [tab]);
  useEffect(() => {
    if (tab !== "tracking" || !autoRefresh) return;
    const id = setInterval(() => loadTracking(), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [tab, autoRefresh]);

  const shipperMarkers = useMemo(() => {
    const markers = [];
    for (const d of deliveries || []) {
      const sid = d.shipper_id || d.driver_id || d.courier_id;
      const lat = d.current_lat ?? d.driver_lat ?? d.shipper_lat ?? d.lat ?? null;
      const lng = d.current_lng ?? d.driver_lng ?? d.shipper_lng ?? d.lng ?? null;

      if (lat != null && lng != null) {
        markers.push({ id: `delivery-${d.id}`, shipper_id: sid, status: d.status || "assigned", lat: Number(lat), lng: Number(lng), label: `#${d.id} • ${d.status || ""}` });
      } else {
        const s = (shippers || []).find((x) => x.id === sid);
        if (s?.lat != null && s?.lng != null) {
          markers.push({ id: `delivery-${d.id}`, shipper_id: sid, status: d.status || "assigned", lat: Number(s.lat), lng: Number(s.lng), label: `#${d.id} • ${d.status || ""}` });
        }
      }
    }
    return markers;
  }, [deliveries, shippers]);

  return (
    <div className="space-y-4">
      {/* Header / Toolbar */}
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Điểm tập kết</h1>
            <p className="text-xs text-gray-600 mt-0.5">Quản lý danh sách điểm hẹn lấy/giao hàng và theo dõi shipper theo thời gian thực.</p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm">
            <button
              className={`px-3 py-1.5 text-sm rounded-lg transition ${tab === "list" ? "bg-emerald-600 text-white shadow" : "hover:bg-gray-50"}`}
              onClick={() => setTab("list")}
            >
              Danh sách
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-lg transition ${tab === "tracking" ? "bg-emerald-600 text-white shadow" : "hover:bg-gray-50"}`}
              onClick={() => setTab("tracking")}
            >
              Theo dõi shipper
            </button>
          </div>
        </div>

        {tab === "list" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                className="w-72 rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Tìm theo tên…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387-1.414 1.414-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </div>
            <Button onClick={load}>Tìm</Button>
            <Button className="ml-auto" onClick={newPoint}>Thêm điểm hẹn</Button>
          </div>
        )}

        {tab === "tracking" && (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="secondary" onClick={loadTracking} disabled={trackingLoading}>
              {trackingLoading ? "Đang tải…" : "Làm mới"}
            </Button>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${autoRefresh ? "bg-emerald-600 text-white shadow" : "bg-white hover:bg-gray-50"}`}
              title="Bật/tắt tự làm mới 10s"
            >
              Tự làm mới: {autoRefresh ? "Bật" : "Tắt"}
            </button>
            <div className="text-xs text-gray-600">
              Vị trí ưu tiên lấy từ đơn giao; nếu không có sẽ dùng vị trí hồ sơ shipper.
            </div>
          </div>
        )}
      </div>

      {/* ======= LIST TAB ======= */}
      {tab === "list" && (
        <Card className="p-0 overflow-x-auto shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Đang tải…</div>
          ) : !items.length ? (
            <Empty title="Chưa có điểm hẹn" />
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Tên</th>
                  <th className="px-3 py-2 font-semibold">Địa chỉ</th>
                  <th className="px-3 py-2 font-semibold">Lat/Lng</th>
                  <th className="px-3 py-2 font-semibold">Giờ mở cửa</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 w-72 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => !q || (i.name || "").toLowerCase().includes(q.toLowerCase()))
                  .map((p, idx) => (
                    <tr key={p.id} className={`border-t transition hover:bg-emerald-50/40 ${idx % 2 ? "bg-white" : "bg-slate-50/20"}`}>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-3 py-2">{p.address || "-"}</td>
                      <td className="px-3 py-2">{[p.lat, p.lng].filter((v) => v != null).join(", ")}</td>
                      <td className="px-3 py-2">{formatOpening(p.opening)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-gray-50 text-gray-600 ring-gray-200"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${p.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {p.status === "active" ? "Hoạt động" : "Tạm dừng"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" onClick={() => { setMode("view"); setEditing({
                            ...p, opening: parseOpening(p.opening) || p.opening || "",
                          }); }}>Xem</Button>
                          <Button variant="secondary" onClick={() => { setMode("edit"); setEditing({
                            ...p, opening: parseOpening(p.opening) || defaultOpening(),
                          }); }}>Sửa</Button>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              const next = p.status === "active" ? "inactive" : "active";
                              await save({ ...p, status: next });
                            }}
                          >
                            {p.status === "active" ? "Tắt" : "Bật"}
                          </Button>
                          <Button variant="ghost" onClick={() => removePoint(p.id)}>Xoá</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ======= TRACKING TAB ======= */}
      {tab === "tracking" && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="h-[70vh]">
            {!mapReady ? (
              <div className="flex h-full items-center justify-center text-gray-500">Đang tải bản đồ…</div>
            ) : (
              <GoogleMap mapContainerClassName="w-full h-full" center={center} zoom={12}>
                {(items || [])
                  .filter((p) => p.lat != null && p.lng != null)
                  .map((p) => (
                    <Marker
                      key={`pp-${p.id}`}
                      position={{ lat: Number(p.lat), lng: Number(p.lng) }}
                      label={{ text: "P", className: "text-emerald-700 font-bold" }}
                      title={`${p.name}\n${p.address || ""}`}
                    />
                  ))}
                {shipperMarkers.map((m) => (
                  <Marker
                    key={m.id}
                    position={{ lat: m.lat, lng: m.lng }}
                    label={{ text: "S", className: "text-blue-700 font-bold" }}
                    title={`Shipper ${m.shipper_id || ""} • ${m.label || ""}`}
                  />
                ))}
              </GoogleMap>
            )}
          </div>

          <div className="border-t p-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1 rounded-lg border bg-emerald-50 px-2 py-1 mr-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" /> Pickup point (P)
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border bg-blue-50 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Shipper (S)
            </span>
          </div>
        </Card>
      )}

      {/* Modal */}
      {editing && (
        <PickupPointModal
          mode={mode}
          point={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

/* =================== Modal với Google Map Picker =================== */
function PickupPointModal({ mode = "edit", point, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const openingObj = parseOpening(point.opening) || (mode === "edit" ? defaultOpening() : point.opening || "");
    return { ...point, opening: openingObj };
  });

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  // esc để đóng
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const readOnly = mode === "view";

  function geocodeAddress() {
    if (!isLoaded) return;
    const addr = (form.address || "").trim();
    if (!addr) return alert("Vui lòng nhập địa chỉ trước");
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: addr }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        setForm((f) => ({ ...f, lat: loc.lat(), lng: loc.lng() }));
      } else {
        alert("Không tìm được toạ độ cho địa chỉ này");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-10 sm:pt-16"
      onClick={onClose}
    >
      <div
        className="mt-2 w-[min(95vw,900px)] max-h-[95vh] overflow-auto rounded-2xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b px-5 py-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
          <div>
            <div className="text-lg font-semibold">
              {form.id ? (readOnly ? "Thông tin điểm tập kết" : "Sửa điểm tập kết") : "Thêm điểm tập kết"}
            </div>
            <div className="text-xs text-gray-500">
              {readOnly
                ? "Xem chi tiết điểm tập kết."
                : "Nhấp lên bản đồ để chọn vị trí. Có thể kéo Marker để tinh chỉnh."}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50">Đóng</button>
        </div>

        <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
          {/* Form */}
          <div className="space-y-3">
            <Field label="Tên điểm tập kết">
              {readOnly ? (
                <div className="text-sm">{form.name || "-"}</div>
              ) : (
                <input
                  className="input w-full"
                  placeholder="VD: Nhà văn hoá phường…"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>

            <Field label="Địa chỉ">
              {readOnly ? (
                <div className="text-sm">{form.address || "-"}</div>
              ) : (
                <>
                  <input
                    className="input w-full"
                    placeholder="Số nhà, đường, phường/xã…"
                    value={form.address || ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  <div className="mt-2">
                    <Button variant="ghost" onClick={geocodeAddress}>
                      Lấy toạ độ từ địa chỉ
                    </Button>
                  </div>
                </>
              )}
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vĩ độ (lat)">
                {readOnly ? (
                  <div className="text-sm">{form.lat ?? "-"}</div>
                ) : (
                  <input
                    className="input w-full"
                    placeholder="16.047079"
                    value={form.lat ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                )}
              </Field>
              <Field label="Kinh độ (lng)">
                {readOnly ? (
                  <div className="text-sm">{form.lng ?? "-"}</div>
                ) : (
                  <input
                    className="input w-full"
                    placeholder="108.206230"
                    value={form.lng ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                )}
              </Field>
            </div>

            <Field label="Giờ mở cửa">
              {readOnly ? (
                <div className="text-sm">
                  {typeof form.opening === "object" ? formatOpening(form.opening) : (form.opening || "-")}
                </div>
              ) : (
                <WeeklyHoursEditor
                  value={parseOpening(form.opening) || defaultOpening()}
                  onChange={(v) => setForm({ ...form, opening: v })}
                />
              )}
            </Field>

            <Field label="Trạng thái">
              {readOnly ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  (form.status || "active") === "active"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-gray-50 text-gray-600 ring-gray-200"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${(form.status || "active") === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {(form.status || "active") === "active" ? "Hoạt động" : "Tạm dừng"}
                </span>
              ) : (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={(form.status || "active") === "active"}
                    onChange={(e) => setForm({ ...form, status: e.target.checked ? "active" : "inactive" })}
                  />
                  Hoạt động
                </label>
              )}
            </Field>
          </div>

          {/* Map picker */}
          <div className="h-80 rounded-xl overflow-hidden border">
            {isLoaded ? (
              <GoogleMap
                mapContainerClassName="w-full h-full"
                center={{ lat: form.lat ?? 16.047079, lng: form.lng ?? 108.20623 }}
                zoom={14}
                onClick={
                  readOnly ? undefined : (e) => setForm({ ...form, lat: e.latLng.lat(), lng: e.latLng.lng() })
                }
              >
                {form.lat != null && form.lng != null && (
                  <Marker
                    position={{ lat: Number(form.lat), lng: Number(form.lng) }}
                    draggable={!readOnly}
                    onDragEnd={
                      readOnly ? undefined : (e) => setForm({ ...form, lat: e.latLng.lat(), lng: e.latLng.lng() })
                    }
                  />
                )}
              </GoogleMap>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">Đang tải bản đồ…</div>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3 sticky bottom-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <Button variant="secondary" onClick={onClose}>Huỷ</Button>
            <Button onClick={() => onSave(form)}>Lưu</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small helper ---------- */
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-gray-600">{label}</div>
      {children}
    </label>
  );
}
