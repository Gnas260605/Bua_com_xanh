// src/pages/AdminDeliveries.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  GoogleMap,
  Marker,
  Polyline,
  Autocomplete,
  DirectionsRenderer,
  useLoadScript,
} from "@react-google-maps/api";

/* ================= Helpers ================= */
function authHeader() {
  const token =
    localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiJSON(url, method = "GET", body) {
  const r = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}
const money = (v) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(v || 0)));

function safeJSON(s) {
  try {
    return typeof s === "string" ? JSON.parse(s) : s;
  } catch {
    return null;
  }
}
function round(n, d = 2) {
  const p = 10 ** d;
  return Math.round(Number(n || 0) * p) / p;
}
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= Page ================= */
export default function AdminDeliveries() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState(null); // {pickup,dropoff}

  const t = useToast();

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    return sp.toString() ? `?${sp.toString()}` : "";
  }, [status, q, page, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(`/api/admin/deliveries${query}`);
      if (Array.isArray(res)) {
        setItems(res);
        setTotal(res.length);
      } else {
        setItems(Array.isArray(res?.items) ? res.items : []);
        setTotal(Number(res?.total || 0));
        if (res?.page) setPage(Number(res.page));
        if (res?.pageSize) setPageSize(Number(res.pageSize));
      }
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
      t.error("Không tải được danh sách đơn giao hàng");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, pageSize, refreshKey]);

  const reload = () => setRefreshKey((k) => k + 1);

  /* ============ Quick actions ============ */
  async function patchStatus(id, next) {
    try {
      await apiJSON(`/api/admin/deliveries/${id}`, "PATCH", { status: next });
      reload();
    } catch (e) {
      t.error(String(e.message || e));
    }
  }
  async function cancel(id) {
    try {
      await apiJSON(`/api/admin/deliveries/${id}/cancel`, "POST");
      reload();
    } catch (e) {
      t.error(String(e.message || e));
    }
  }
  async function genOTP(id) {
    try {
      const r = await apiJSON(`/api/deliveries/${id}/generate-otp`, "POST");
      t.success(`OTP: ${r.otp}`);
      reload();
    } catch (e) {
      t.error(String(e.message || e));
    }
  }
  async function reassign(d) {
    const input = prompt("Nhập Shipper ID muốn gán:");
    if (!input) return;
    const sid = Number(input);
    if (!Number.isFinite(sid) || sid <= 0) return t.error("Shipper ID không hợp lệ");
    try {
      await apiJSON(`/api/admin/deliveries/assign`, "POST", {
        booking_id: d.booking_id,
        shipper_id: sid,
      });
      t.success("Đã gán shipper");
      reload();
    } catch (e) {
      t.error(String(e.message || e));
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">pending</option>
          <option value="assigned">assigned</option>
          <option value="picking">picking</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
        </select>

        <input
          className="input w-64"
          placeholder="Tìm ID / booking / shipper / địa chỉ"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Button onClick={load}>Làm mới</Button>

        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>+ Tạo đơn kiểu Grab</Button>
        </div>
      </div>

      {/* List */}
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Đang tải…</div>
        ) : !items.length ? (
          <Empty
            title="Chưa có đơn"
            subtitle="Bấm “+ Tạo đơn kiểu Grab” để tạo nhanh"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Shipper</th>
                <th className="px-3 py-2">Lộ trình</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">OTP</th>
                <th className="px-3 py-2 w-[520px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const geo = safeJSON(d.route_geojson);
                const pickup = geo?.pickup || geo?.features?.[0]?.properties || null;
                const dropoff = geo?.dropoff || geo?.features?.[1]?.properties || null;

                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">{d.id}</td>
                    <td className="px-3 py-2">{d.booking_id}</td>
                    <td className="px-3 py-2">
                      {d.shipper_id ?? <i className="text-slate-400">chưa gán</i>}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[420px]">
                      {pickup?.address || dropoff?.address ? (
                        <>
                          <span>{pickup?.address || "P?"}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span>{dropoff?.address || "D?"}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill value={d.status} />
                    </td>
                    <td className="px-3 py-2">
                      {d.otp_code || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setPreview({
                            pickup:
                              geo?.pickup ||
                              geo?.features?.[0]?.geometry?.coordinates
                                ? {
                                    lat: geo.features[0].geometry.coordinates[1],
                                    lng: geo.features[0].geometry.coordinates[0],
                                    address: geo.features[0].properties?.address || "",
                                  }
                                : null,
                            dropoff:
                              geo?.dropoff ||
                              geo?.features?.[1]?.geometry?.coordinates
                                ? {
                                    lat: geo.features[1].geometry.coordinates[1],
                                    lng: geo.features[1].geometry.coordinates[0],
                                    address: geo.features[1].properties?.address || "",
                                  }
                                : null,
                          })
                        }
                      >
                        Xem lộ trình
                      </Button>

                      {!d.shipper_id && (
                        <Button variant="secondary" onClick={() => reassign(d)}>
                          Gán/đổi shipper
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        onClick={() => patchStatus(d.id, "picking")}
                      >
                        → picking
                      </Button>
                      <Button onClick={() => patchStatus(d.id, "delivered")}>
                        → delivered
                      </Button>
                      <Button variant="danger" onClick={() => cancel(d.id)}>
                        Hủy
                      </Button>
                      <Button variant="secondary" onClick={() => genOTP(d.id)}>
                        Tạo OTP
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-slate-500">Tổng: {total}</span>
        <select
          className="input w-24"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Trước
        </Button>
        <span className="px-2">Trang {page}</span>
        <Button
          variant="secondary"
          disabled={items.length < pageSize && total <= page * pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Sau →
        </Button>
      </div>

      {/* Create modal */}
      {createOpen && (
        <CreateDeliverySheet
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      )}

      {/* Quick preview */}
      {preview && (
        <MapPreviewModal data={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

/* ================= Create Sheet (full-screen, Directions + Distance Matrix) ================= */
function CreateDeliverySheet({ onClose, onCreated }) {
  const t = useToast();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
    language: "vi",
    region: "VN",
  });

  const [step, setStep] = useState(1);
  const [activePin, setActivePin] = useState("pickup");

  // Places refs
  const pickAC = useRef(null);
  const dropAC = useRef(null);

  // Pickup / Dropoff
  const [pick, setPick] = useState({
    address: "",
    lat: 16.047079,
    lng: 108.20623,
    contact_name: "",
    contact_phone: "",
  });
  const [drop, setDrop] = useState({
    address: "",
    lat: null,
    lng: null,
    contact_name: "",
    contact_phone: "",
  });

  // Options
  const [opts, setOpts] = useState({
    service: "bike",
    schedule_type: "asap",
    schedule_at: "",
    cod: 0,
    tip: 0,
    note: "",
    auto_assign: true,
    shipper_id: "",
  });

  // Route estimate + Directions
  const [route, setRoute] = useState({ distance_km: 0, duration_min: 0 });
  const [estimating, setEstimating] = useState(false);
  const [directions, setDirections] = useState(null);

  const center = useMemo(() => {
    if (activePin === "dropoff" && drop.lat && drop.lng)
      return { lat: drop.lat, lng: drop.lng };
    return { lat: pick.lat, lng: pick.lng };
  }, [activePin, pick, drop]);

  /* ---------- Helpers: geocode & reverse-geocode ---------- */
  function geocode(addr, setter) {
    if (!isLoaded || !addr?.trim()) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: addr }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        setter((s) => ({
          ...s,
          address: results[0].formatted_address || s.address,
          lat: loc.lat(),
          lng: loc.lng(),
        }));
      } else {
        t.error("Không tìm được toạ độ");
      }
    });
  }
  function reverseGeocode(lat, lng, setter) {
    if (!isLoaded) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      setter((s) => ({
        ...s,
        lat,
        lng,
        address:
          status === "OK" && results?.[0]?.formatted_address
            ? results[0].formatted_address
            : s.address,
      }));
    });
  }

  /* ---------- Places handlers ---------- */
  function onPickChanged() {
    const p = pickAC.current?.getPlace?.();
    if (!p?.geometry?.location) return;
    const loc = p.geometry.location;
    setPick((s) => ({
      ...s,
      address: p.formatted_address || s.address,
      lat: loc.lat(),
      lng: loc.lng(),
    }));
  }
  function onDropChanged() {
    const p = dropAC.current?.getPlace?.();
    if (!p?.geometry?.location) return;
    const loc = p.geometry.location;
    setDrop((s) => ({
      ...s,
      address: p.formatted_address || s.address,
      lat: loc.lat(),
      lng: loc.lng(),
    }));
  }

  /* ---------- Directions API & Distance Matrix API ---------- */
  function directionsRoute(origin, destination) {
    return new Promise((resolve) => {
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (res, status) => resolve(status === "OK" ? res : null)
      );
    });
  }
  function distanceMatrix(origin, destination) {
    return new Promise((resolve) => {
      const svc = new window.google.maps.DistanceMatrixService();
      svc.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.METRIC,
        },
        (res, status) => resolve(status === "OK" ? res : null)
      );
    });
  }

  async function estimate() {
    if (!isLoaded || pick.lat == null || drop.lat == null) return;
    setEstimating(true);
    try {
      const origin = new window.google.maps.LatLng(pick.lat, pick.lng);
      const destination = new window.google.maps.LatLng(drop.lat, drop.lng);

      // 1) Directions API (để hiển thị tuyến đường thực tế)
      const dirRes = await directionsRoute(origin, destination);
      if (dirRes) setDirections(dirRes);

      // 2) Distance Matrix API (đo khoảng cách & thời gian chuẩn)
      let km = 0;
      let min = 0;
      const dmRes = await distanceMatrix(origin, destination);
      if (dmRes?.rows?.[0]?.elements?.[0]) {
        const el = dmRes.rows[0].elements[0];
        km = (el.distance?.value || 0) / 1000;
        min = (el.duration?.value || 0) / 60;
      }

      // 3) Fallback từ Directions nếu DM không có giá trị
      if ((!km || !min) && dirRes?.routes?.[0]?.legs?.[0]) {
        const leg = dirRes.routes[0].legs[0];
        km = (leg.distance?.value || 0) / 1000;
        min = (leg.duration?.value || 0) / 60;
      }

      // 4) Fallback cuối cùng: Haversine
      if (!km) {
        km = haversine(pick.lat, pick.lng, drop.lat, drop.lng);
        min = (km / 25) * 60;
      }

      setRoute({ distance_km: round(km, 2), duration_min: Math.round(min) });
    } catch {
      // fallback cuối cùng
      const km = haversine(pick.lat, pick.lng, drop.lat, drop.lng);
      const min = (km / 25) * 60;
      setRoute({ distance_km: round(km, 2), duration_min: Math.round(min) });
    } finally {
      setEstimating(false);
    }
  }
  useEffect(() => {
    estimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick.lat, pick.lng, drop.lat, drop.lng, isLoaded]);

  const estimateFee = useMemo(() => {
    const base = opts.service === "car" ? 18000 : 12000;
    const perKm = opts.service === "car" ? 7000 : 4500;
    const fee = base + Math.max(0, route.distance_km - 2) * perKm + Number(opts.tip || 0);
    return Math.max(0, fee);
  }, [opts.service, route.distance_km, opts.tip]);

  /* ---------- Submit ---------- */
  async function submit() {
    try {
      if (!pick.lat || !pick.lng || !drop.lat || !drop.lng) {
        return t.error("Vui lòng chọn đầy đủ điểm lấy/giao trên bản đồ.");
      }

      if (opts.auto_assign) {
        // Public endpoint: tạo + tự gán shipper
        await apiJSON(`/api/deliveries/request`, "POST", {
          pickup: {
            address: pick.address,
            lat: pick.lat,
            lng: pick.lng,
            contact_name: pick.contact_name,
            contact_phone: pick.contact_phone,
          },
          dropoff: {
            address: drop.address,
            lat: drop.lat,
            lng: drop.lng,
            contact_name: drop.contact_name,
            contact_phone: drop.contact_phone,
          },
          service: opts.service,
          schedule_type: opts.schedule_type,
          schedule_at:
            opts.schedule_type === "later" ? opts.schedule_at || null : null,
          cod: Number(opts.cod || 0),
          tip: Number(opts.tip || 0),
          note: opts.note || "",
          auto_assign: true,
          estimate: {
            distance_km: route.distance_km,
            duration_min: route.duration_min,
            fee: Math.round(estimateFee),
          },
        });
      } else {
        // Quy trình cũ (admin)
        const created = await apiJSON(`/api/admin/deliveries/create`, "POST", {});
        const route_geojson = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                kind: "pickup",
                address: pick.address,
                contact_name: pick.contact_name,
                contact_phone: pick.contact_phone,
              },
              geometry: { type: "Point", coordinates: [pick.lng, pick.lat] },
            },
            {
              type: "Feature",
              properties: {
                kind: "dropoff",
                address: drop.address,
                contact_name: drop.contact_name,
                contact_phone: drop.contact_phone,
              },
              geometry: { type: "Point", coordinates: [drop.lng, drop.lat] },
            },
          ],
          meta: {
            distance_km: route.distance_km,
            duration_min: route.duration_min,
            service: opts.service,
            schedule_type: opts.schedule_type,
            schedule_at:
              opts.schedule_type === "later" ? opts.schedule_at || null : null,
            cod: Number(opts.cod || 0),
            tip: Number(opts.tip || 0),
            estimate_fee: Math.round(estimateFee),
            note: opts.note || "",
          },
        };
        await apiJSON(`/api/admin/deliveries/${created.id}`, "PATCH", {
          route_geojson,
        });
        const sid = (opts.shipper_id || "").trim();
        if (sid) {
          await apiJSON(`/api/admin/deliveries/assign`, "POST", {
            booking_id: created.booking_id,
            shipper_id: Number(sid),
          });
        }
      }
      onCreated?.();
    } catch (e) {
      t.error(String(e.message || e));
    }
  }

  /* ---------- UI ---------- */
  const disabledNext =
    (step === 1 && (!pick.lat || !pick.lng)) ||
    (step === 2 && (!drop.lat || !drop.lng)) ||
    (step === 3 &&
      opts.schedule_type === "later" &&
      (!opts.schedule_at || isNaN(Date.parse(opts.schedule_at))));

  const mapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    if (activePin === "pickup") reverseGeocode(lat, lng, setPick);
    else reverseGeocode(lat, lng, setDrop);
  };

  // ESC để đóng
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/50">
      <div className="mx-auto my-8 w-[min(1280px,95vw)] rounded-2xl border bg-white shadow-2xl">
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="text-xl font-semibold">Tạo đơn giao hàng (kiểu Grab)</div>
          <button
            className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
            onClick={onClose}
            aria-label="Đóng"
          >
            Đóng
          </button>
        </div>

        {/* Body – scroll dọc, 2 cột 5/7 */}
        <div className="max-h-[calc(100vh-190px)] overflow-y-auto px-6 py-4">
          {/* Stepper */}
          <div className="mb-4 flex items-center gap-3 text-sm">
            {["Điểm lấy", "Điểm giao", "Tùy chọn", "Xác nhận"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full border text-[12px] ${
                    step >= i + 1
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "text-slate-600"
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`${step >= i + 1 ? "text-emerald-700" : "text-slate-600"}`}
                >
                  {s}
                </div>
                {i < 3 && <div className="mx-2 h-px w-10 bg-slate-200" />}
              </div>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            {/* Left form (5/12) */}
            <div className="md:col-span-5 space-y-5">
              {step === 1 && (
                <>
                  <Field label="Địa chỉ lấy hàng">
                    <div className="flex gap-2">
                      {isLoaded ? (
                        <Autocomplete
                          onLoad={(ac) => (pickAC.current = ac)}
                          onPlaceChanged={onPickChanged}
                        >
                          <input
                            className="input w-full py-2.5"
                            placeholder="Nhập địa chỉ"
                            value={pick.address}
                            onChange={(e) =>
                              setPick((s) => ({ ...s, address: e.target.value }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && geocode(pick.address, setPick)
                            }
                            onBlur={() => geocode(pick.address, setPick)}
                          />
                        </Autocomplete>
                      ) : (
                        <input
                          className="input w-full py-2.5"
                          value={pick.address}
                          onChange={(e) =>
                            setPick((s) => ({ ...s, address: e.target.value }))
                          }
                        />
                      )}
                      <Button variant="secondary" onClick={() => geocode(pick.address, setPick)}>
                        Lấy tọa độ
                      </Button>
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Vĩ độ (lat)">
                      <input
                        className="input w-full py-2.5"
                        value={pick.lat ?? ""}
                        onChange={(e) =>
                          setPick((s) => ({
                            ...s,
                            lat: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Kinh độ (lng)">
                      <input
                        className="input w-full py-2.5"
                        value={pick.lng ?? ""}
                        onChange={(e) =>
                          setPick((s) => ({
                            ...s,
                            lng: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Người liên hệ">
                      <input
                        className="input w-full py-2.5"
                        value={pick.contact_name}
                        onChange={(e) =>
                          setPick((s) => ({ ...s, contact_name: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="SĐT">
                      <input
                        className="input w-full py-2.5"
                        value={pick.contact_phone}
                        onChange={(e) =>
                          setPick((s) => ({ ...s, contact_phone: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Địa chỉ giao">
                    <div className="flex gap-2">
                      {isLoaded ? (
                        <Autocomplete
                          onLoad={(ac) => (dropAC.current = ac)}
                          onPlaceChanged={onDropChanged}
                        >
                          <input
                            className="input w-full py-2.5"
                            placeholder="Nhập địa chỉ"
                            value={drop.address}
                            onChange={(e) =>
                              setDrop((s) => ({ ...s, address: e.target.value }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && geocode(drop.address, setDrop)
                            }
                            onBlur={() => geocode(drop.address, setDrop)}
                          />
                        </Autocomplete>
                      ) : (
                        <input
                          className="input w-full py-2.5"
                          value={drop.address}
                          onChange={(e) =>
                            setDrop((s) => ({ ...s, address: e.target.value }))
                          }
                        />
                      )}
                      <Button variant="secondary" onClick={() => geocode(drop.address, setDrop)}>
                        Lấy tọa độ
                      </Button>
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Vĩ độ (lat)">
                      <input
                        className="input w-full py-2.5"
                        value={drop.lat ?? ""}
                        onChange={(e) =>
                          setDrop((s) => ({
                            ...s,
                            lat: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Kinh độ (lng)">
                      <input
                        className="input w-full py-2.5"
                        value={drop.lng ?? ""}
                        onChange={(e) =>
                          setDrop((s) => ({
                            ...s,
                            lng: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Người nhận">
                      <input
                        className="input w-full py-2.5"
                        value={drop.contact_name}
                        onChange={(e) =>
                          setDrop((s) => ({ ...s, contact_name: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="SĐT">
                      <input
                        className="input w-full py-2.5"
                        value={drop.contact_phone}
                        onChange={(e) =>
                          setDrop((s) => ({ ...s, contact_phone: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Loại dịch vụ">
                    <div className="inline-flex rounded-xl border p-1 bg-slate-50">
                      <button
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                          opts.service === "bike"
                            ? "bg-emerald-600 text-white"
                            : "text-slate-700 hover:bg-white"
                        }`}
                        onClick={() => setOpts((s) => ({ ...s, service: "bike" }))}
                      >
                        Xe máy
                      </button>
                      <button
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                          opts.service === "car"
                            ? "bg-emerald-600 text-white"
                            : "text-slate-700 hover:bg-white"
                        }`}
                        onClick={() => setOpts((s) => ({ ...s, service: "car" }))}
                      >
                        Ô tô
                      </button>
                    </div>
                  </Field>

                  <Field label="Lịch giao">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input
                          type="radio"
                          name="schedule"
                          checked={opts.schedule_type === "asap"}
                          onChange={() =>
                            setOpts((s) => ({ ...s, schedule_type: "asap" }))
                          }
                        />
                        Giao ngay
                      </label>
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input
                          type="radio"
                          name="schedule"
                          checked={opts.schedule_type === "later"}
                          onChange={() =>
                            setOpts((s) => ({ ...s, schedule_type: "later" }))
                          }
                        />
                        Hẹn giờ
                      </label>
                      {opts.schedule_type === "later" && (
                        <input
                          type="datetime-local"
                          className="input"
                          value={opts.schedule_at}
                          onChange={(e) =>
                            setOpts((s) => ({ ...s, schedule_at: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="COD (VND)">
                      <input
                        className="input w-full py-2.5"
                        type="number"
                        min="0"
                        value={opts.cod}
                        onChange={(e) =>
                          setOpts((s) => ({ ...s, cod: Number(e.target.value || 0) }))
                        }
                      />
                    </Field>
                    <Field label="Tip (VND)">
                      <input
                        className="input w-full py-2.5"
                        type="number"
                        min="0"
                        value={opts.tip}
                        onChange={(e) =>
                          setOpts((s) => ({ ...s, tip: Number(e.target.value || 0) }))
                        }
                      />
                    </Field>
                    <Field label="Tự gán shipper">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={opts.auto_assign}
                          onChange={(e) =>
                            setOpts((s) => ({ ...s, auto_assign: e.target.checked }))
                          }
                        />
                        Bật
                      </label>
                    </Field>
                  </div>

                  {!opts.auto_assign && (
                    <Field label="Shipper ID (nếu tắt tự gán)">
                      <input
                        className="input w-full py-2.5"
                        value={opts.shipper_id}
                        onChange={(e) =>
                          setOpts((s) => ({ ...s, shipper_id: e.target.value }))
                        }
                      />
                    </Field>
                  )}

                  <Field label="Ghi chú cho tài xế">
                    <textarea
                      className="input w-full"
                      rows={3}
                      value={opts.note}
                      onChange={(e) => setOpts((s) => ({ ...s, note: e.target.value }))}
                    />
                  </Field>
                </>
              )}

              {step === 4 && (
                <div className="space-y-3 text-sm">
                  <div>
                    <b>Tuyến đường:</b>{" "}
                    <span className="text-slate-700">
                      {pick.address || `${pick.lat}, ${pick.lng}`}
                    </span>{" "}
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="text-slate-700">
                      {drop.address || `${drop.lat}, ${drop.lng}`}
                    </span>
                  </div>
                  <div>
                    <b>Khoảng cách:</b>{" "}
                    {estimating ? "…" : `${route.distance_km} km`} •{" "}
                    <b>Thời gian:</b>{" "}
                    {estimating ? "…" : `${route.duration_min} phút`}
                  </div>
                  <div>
                    <b>Dịch vụ:</b> {opts.service === "car" ? "Ô tô" : "Xe máy"} •{" "}
                    <b>Giá tạm tính:</b> {money(estimateFee)}
                  </div>
                  {opts.tip ? (
                    <div>
                      <b>Tip:</b> {money(opts.tip)}
                    </div>
                  ) : null}
                  {opts.cod ? (
                    <div>
                      <b>COD:</b> {money(opts.cod)}
                    </div>
                  ) : null}
                  <div>
                    <b>Lịch:</b>{" "}
                    {opts.schedule_type === "asap"
                      ? "Giao ngay"
                      : new Date(opts.schedule_at).toLocaleString()}
                  </div>
                  <div>
                    <b>Tự gán shipper:</b>{" "}
                    {opts.auto_assign
                      ? "Có"
                      : `Không${opts.shipper_id ? `, shipper: ${opts.shipper_id}` : ""}`}
                  </div>
                </div>
              )}
            </div>

            {/* Right map (7/12) */}
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Đặt điểm bằng bản đồ:</span>
                <div className="inline-flex rounded-xl border p-1 bg-slate-50">
                  <button
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activePin === "pickup"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    onClick={() => setActivePin("pickup")}
                  >
                    Pickup (P)
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activePin === "dropoff"
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    onClick={() => setActivePin("dropoff")}
                  >
                    Dropoff (D)
                  </button>
                </div>
              </div>

              <div className="relative h-[620px] rounded-xl overflow-hidden border">
                {!isLoaded ? (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    {loadError
                      ? "Không tải được Google Maps (kiểm tra API key)."
                      : "Đang tải bản đồ…"}
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerClassName="w-full h-full"
                    center={center}
                    zoom={13}
                    onClick={mapClick}
                  >
                    {pick.lat != null && pick.lng != null && (
                      <Marker
                        position={{ lat: Number(pick.lat), lng: Number(pick.lng) }}
                        draggable
                        label={{ text: "P", className: "text-emerald-700 font-bold" }}
                        onDragEnd={(e) =>
                          reverseGeocode(e.latLng.lat(), e.latLng.lng(), setPick)
                        }
                      />
                    )}
                    {drop.lat != null && drop.lng != null && (
                      <Marker
                        position={{ lat: Number(drop.lat), lng: Number(drop.lng) }}
                        draggable
                        label={{ text: "D", className: "text-blue-700 font-bold" }}
                        onDragEnd={(e) =>
                          reverseGeocode(e.latLng.lat(), e.latLng.lng(), setDrop)
                        }
                      />
                    )}

                    {/* Vẽ tuyến đường từ Directions API nếu có; nếu chưa có, tạm nối thẳng */}
                    {directions ? (
                      <DirectionsRenderer directions={directions} />
                    ) : (
                      pick.lat != null &&
                      drop.lat != null && (
                        <Polyline
                          path={[
                            { lat: Number(pick.lat), lng: Number(pick.lng) },
                            { lat: Number(drop.lat), lng: Number(drop.lng) },
                          ]}
                          options={{ strokeOpacity: 0.9, strokeWeight: 4 }}
                        />
                      )
                    )}
                  </GoogleMap>
                )}

                {/* Info chip nổi */}
                <div className="pointer-events-none absolute right-3 top-3 rounded-xl border bg-white/90 px-3 py-2 text-xs shadow">
                  <div><b>Khoảng cách:</b> {estimating ? "…" : `${route.distance_km} km`}</div>
                  <div><b>Thời gian:</b> {estimating ? "…" : `${route.duration_min} phút`}</div>
                  <div><b>Phí tạm tính:</b> {money(estimateFee)}</div>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                Nhập địa chỉ để tìm tự động; hoặc click bản đồ / kéo thả marker để chọn chính xác.
              </div>
            </div>
          </div>
        </div>

        {/* Footer sticky */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t bg-white px-6 py-3">
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          {step < 4 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                ← Quay lại
              </Button>
              <Button
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                disabled={disabledNext}
              >
                Tiếp tục →
              </Button>
            </div>
          ) : (
            <Button onClick={submit}>Tạo đơn</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Small map preview (dùng Directions khi có) ================= */
function MapPreviewModal({ data, onClose }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  const center = useMemo(() => {
    if (data?.pickup?.lat) return { lat: data.pickup.lat, lng: data.pickup.lng };
    return { lat: 16.047079, lng: 108.20623 };
  }, [data]);

  const [directions, setDirections] = useState(null);

  useEffect(() => {
    if (!isLoaded || !data?.pickup || !data?.dropoff) return;
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: data.pickup.lat, lng: data.pickup.lng },
        destination: { lat: data.dropoff.lat, lng: data.dropoff.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (res, status) => setDirections(status === "OK" ? res : null)
    );
  }, [isLoaded, data]);

  return (
    <div className="fixed inset-0 z-[210] bg-black/50" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 w-[min(900px,96vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">Lộ trình</div>
          <button className="rounded-lg border px-2 py-1 text-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
        <div className="h-[480px]">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              Đang tải bản đồ…
            </div>
          ) : (
            <GoogleMap mapContainerClassName="w-full h-full" center={center} zoom={13}>
              {data?.pickup && (
                <Marker
                  position={{ lat: data.pickup.lat, lng: data.pickup.lng }}
                  label={{ text: "P", className: "text-emerald-700 font-bold" }}
                />
              )}
              {data?.dropoff && (
                <Marker
                  position={{ lat: data.dropoff.lat, lng: data.dropoff.lng }}
                  label={{ text: "D", className: "text-blue-700 font-bold" }}
                />
              )}
              {directions ? (
                <DirectionsRenderer directions={directions} />
              ) : (
                data?.pickup &&
                data?.dropoff && (
                  <Polyline
                    path={[
                      { lat: data.pickup.lat, lng: data.pickup.lng },
                      { lat: data.dropoff.lat, lng: data.dropoff.lng },
                    ]}
                    options={{ strokeOpacity: 0.9, strokeWeight: 4 }}
                  />
                )
              )}
            </GoogleMap>
          )}
        </div>
        <div className="p-3 text-xs text-slate-600">P: Điểm lấy • D: Điểm giao</div>
      </div>
    </div>
  );
}

/* ================= Tiny UI ================= */
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[13px] font-medium text-gray-700">{label}</div>
      {children}
    </label>
  );
}
function StatusPill({ value }) {
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    assigned: "bg-sky-50 text-sky-700 border-sky-200",
    picking: "bg-violet-50 text-violet-700 border-violet-200",
    in_progress: "bg-violet-50 text-violet-700 border-violet-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = map[value] || "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {value}
    </span>
  );
}
