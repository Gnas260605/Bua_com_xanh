// src/pages/Campaigns.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import CampaignCard from "../components/campaigns/CampaignCard.jsx";

/* ========================= UI PRIMITIVES (rực rỡ + rõ chữ) ========================= */
const Card = ({ className = "", children }) => (
  <div
    className={[
      "rounded-2xl border shadow-sm",
      "bg-white text-slate-900 border-slate-200",
      "hover:shadow-md transition-shadow",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border bg-white",
      "px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none",
      "border-slate-300 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500",
      props.className || "",
    ].join(" ")}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={[
      "w-full rounded-xl border bg-white",
      "px-3 py-2 text-slate-900 outline-none",
      "border-slate-300 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500",
      props.className || "",
    ].join(" ")}
  />
);

const Btn = ({ children, variant = "primary", className = "", ...rest }) => {
  const styles =
    variant === "primary"
      ? // gradient rực rỡ
        "bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-500 focus:ring-emerald-200"
      : variant === "ghost"
      ? "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 focus:ring-slate-200"
      : "bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-200";
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold",
        "focus:outline-none focus:ring-4 transition",
        styles,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

const Stat = ({ label, value }) => (
  <Card className="p-4 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60" />
    <div className="text-xs text-slate-600">{label}</div>
    <div className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">{value}</div>
  </Card>
);

const SkeletonCard = () => (
  <Card className="overflow-hidden animate-pulse">
    <div className="h-44 w-full bg-slate-100" />
    <div className="p-4 space-y-3">
      <div className="h-5 bg-slate-200 rounded w-3/4" />
      <div className="h-4 bg-slate-200 rounded w-5/6" />
      <div className="h-2 bg-slate-200 rounded w-full" />
      <div className="flex gap-2">
        <div className="h-5 bg-slate-200 rounded-full w-16" />
        <div className="h-5 bg-slate-200 rounded-full w-14" />
        <div className="h-5 bg-slate-200 rounded-full w-12" />
      </div>
    </div>
  </Card>
);

/* ============================ Helpers ============================ */
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const parseJson = (raw, fb = {}) => { try { return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : fb; } catch { return fb; } };
function isMealCampaign(c = {}) {
  const t = (c.type || c.kind || c.category || "").toString().toLowerCase();
  return t === "meal" || t.includes("meal") || t.includes("bữa");
}
function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const ra = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(ra)));
}
function buildVietQRUrl({ bank, account, name, memo, amount }) {
  if (!bank || !account) return "";
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.jpg`;
  const p = new URLSearchParams();
  if (name) p.set("accountName", name);
  if (memo) p.set("addInfo", memo);
  if (amount && Number(amount) > 0) p.set("amount", String(amount));
  return `${base}?${p.toString()}`;
}
function normalizeCampaign(r) {
  const meta = parseJson(r.meta ?? r.tags, {});
  const type = r.type || meta?.type || "money";
  const payment = meta?.payment || {};
  const meal = meta?.meal || {};
  return {
    id: r.id,
    title: r.title || "",
    description: r.description || "",
    location: r.location || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline || meta?.end_at || null,
    status: r.status || "active",
    target_amount: toNum(r.target_amount ?? r.goal, 0),
    raised_amount: toNum(r.raised_amount ?? r.raised, 0),
    supporters: toNum(r.supporters, 0),
    type,
    meal_unit: meal?.unit || "phần",
    meal_target_qty: toNum(meal?.target_qty, 0),
    meal_received_qty: toNum(meal?.received_qty, 0),
    meta,
    payment,
    payment_method: payment?.method || "momo",
    cover_url: r.cover_url || r.cover || "",
    tags: Array.isArray(r.tags) ? r.tags : [],
  };
}

/* ============================ Payment Helpers ============================ */
async function createPayment({ method, amount, campaign_id, orderInfo, extraData }) {
  const m = (method || "").toLowerCase();
  const body = { amount: Number(amount), orderInfo: orderInfo || "Ủng hộ", extraData: extraData || "", campaign_id, method: m || undefined };
  if (m === "momo") {
    const res = await apiPost("/api/payments/momo/create", body);
    return { pay_url: res?.payUrl || res?.momoRaw?.deeplink || res?.momoRaw?.payUrl, qr_svg: res?.qr_svg, qr_image: res?.qr_image, raw: res };
  }
  const res = await apiPost("/api/payments/create", body).catch(() => ({}));
  return { pay_url: res?.pay_url || res?.payUrl, qr_svg: res?.qr_svg, qr_image: res?.qr_image, raw: res };
}
function gatewaysForCampaign(campaign, globalGateways) {
  const m = (campaign?.payment_method || "").toLowerCase();
  if (m === "momo") return [{ code: "momo", name: "MoMo" }];
  if (m === "custom_qr") return [{ code: "custom_qr", name: "QR tải lên" }];
  if (m === "vietqr") return [{ code: "vietqr", name: "VietQR" }];
  const g = (globalGateways || []).map((x) => ({ ...x, code: (x.code || "").toLowerCase() }));
  return g.length ? g : [{ code: "momo", name: "MoMo" }];
}

/* ============================ Donate Money Modal ============================ */
function DonateMoneyModal({ open, onClose, campaign, globalGateways }) {
  const gateways = useMemo(() => gatewaysForCampaign(campaign, globalGateways), [campaign, globalGateways]);
  const [amount, setAmount] = useState(200000);
  const [method, setMethod] = useState(gateways?.[0]?.code || "momo");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState({ img: "", svg: "" });

  useEffect(() => {
    if (!open) return;
    setAmount(200000); setMethod(gateways?.[0]?.code || "momo");
    setSubmitting(false); setErr(""); setQr({ img: "", svg: "" });
  }, [open, gateways]);

  async function handleCreate() {
    try {
      setErr(""); setSubmitting(true); setQr({ img: "", svg: "" });
      const m = (method || "").toLowerCase();

      if (m === "custom_qr") {
        const img = campaign?.payment?.qr_url || "";
        if (!img) throw new Error("Chiến dịch chưa cấu hình QR.");
        setQr({ img, svg: "" }); return;
      }
      if (m === "vietqr") {
        const img = campaign?.payment?.qr_url || buildVietQRUrl({
          bank: campaign?.payment?.bank, account: campaign?.payment?.account, name: campaign?.payment?.name, memo: campaign?.payment?.memo, amount,
        });
        if (!img) throw new Error("Không tạo được QR VietQR (thiếu bank/account).");
        setQr({ img, svg: "" }); return;
      }

      const resp = await createPayment({
        method: m, amount: Number(amount || 0), campaign_id: campaign?.id, orderInfo: `Ủng hộ chiến dịch ${campaign?.title || ""}`.trim(),
      });

      if (resp?.pay_url) { window.location.href = resp.pay_url; return; }
      if (resp?.qr_image || resp?.qr_svg) { setQr({ img: resp.qr_image || "", svg: resp.qr_svg || "" }); return; }
      setErr("Chưa nhận được liên kết thanh toán/QR. Vui lòng thử lại.");
    } catch (e) {
      setErr(e?.message || "Không tạo được giao dịch. Vui lòng thử lại.");
    } finally { setSubmitting(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overscroll-contain">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200">
          <div className="text-lg font-bold">Ủng hộ chiến dịch</div>
          <div className="text-sm text-slate-700 line-clamp-2">{campaign?.title}</div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-slate-700">Số tiền (đ)</label>
            <Input type="number" min={10000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
            <div className="mt-2 flex flex-wrap gap-2">
              {[50000, 100000, 200000, 500000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={[
                    "px-3 py-1 rounded-xl border transition",
                    Number(amount) === v ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  {v.toLocaleString("vi-VN")} đ
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Select className="mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                {gateways.map((g) => <option key={g.code} value={g.code}>{g.name || g.code}</option>)}
              </Select>
              <div className="mt-1 text-xs text-slate-500">
                {campaign?.payment_method ? `Cấu hình của chiến dịch: ${campaign.payment_method}` : "Mặc định MoMo nếu chiến dịch không cấu hình riêng."}
              </div>
            </div>
            <div className="flex items-end">
              <Btn className="w-full" onClick={handleCreate} disabled={submitting || Number(amount) < 10000}>
                {submitting ? "Đang tạo…" : "Tạo giao dịch"}
              </Btn>
            </div>
          </div>

          {err ? <div className="text-sm text-rose-600">{err}</div> : null}
          {(qr.img || qr.svg) && (
            <div className="mt-2 flex flex-col items-center gap-2">
              {qr.svg ? <div className="w-56 h-56 bg-white rounded-xl p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} /> :
                <img src={qr.img} alt="QR" className="w-56 h-56 object-contain bg-white rounded-xl p-2" />}
              <div className="text-xs text-slate-500">Quét QR để hoàn tất ủng hộ</div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Đóng</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================ Donate Meal Modal ============================ */
function DonateMealModal({ open, onClose, campaign, globalGateways = [], mealPrice = 10000 }) {
  const gateways = useMemo(() => gatewaysForCampaign(campaign, globalGateways), [campaign, globalGateways]);
  const [tab, setTab] = useState("money");
  const [mealsMoney, setMealsMoney] = useState(10);
  const [method, setMethod] = useState(gateways?.[0]?.code || "momo");
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [qr, setQr] = useState({ img: "", svg: "" });

  const [mealsKind, setMealsKind] = useState(10);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [points, setPoints] = useState([]);
  const [pointsErr, setPointsErr] = useState("");
  const [myLoc, setMyLoc] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [submittingKind, setSubmittingKind] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("money"); setMealsMoney(10); setMethod(gateways?.[0]?.code || "momo");
    setPaying(false); setPayErr(""); setQr({ img: "", svg: "" });
    setMealsKind(10); setSubmittingKind(false); setSubmitMsg(""); setGeoErr("");

    let mounted = true;
    (async () => {
      setLoadingPoints(true); setPointsErr("");
      try {
        let res = await apiGet("/api/pickup-points?active=1").catch(() => null);
        if (!res) {
          const s = await apiGet("/api/site-settings?key=pickup_points").catch(() => null);
          res = s?.value || s?.items || [];
        }
        if (!Array.isArray(res)) res = res?.items ?? res?.value ?? [];
        if (!Array.isArray(res)) res = [];
        const normalized = res
          .map((p) => {
            const lat = Number(p.lat ?? p.latitude);
            const lng = Number(p.lng ?? p.longitude);
            return {
              id: p.id ?? p.point_id ?? p.code ?? Math.random().toString(36).slice(2),
              name: p.name ?? p.title ?? "Điểm nhận",
              address: p.address ?? p.location ?? "",
              lat: Number.isFinite(lat) ? lat : null,
              lng: Number.isFinite(lng) ? lng : null,
              open_hours: p.open_hours ?? p.opening ?? p.hours ?? "",
              status: p.status ?? (p.active ? "active" : "inactive"),
            };
          })
          .filter(Boolean)
          .filter((p) => (p.status || "active") === "active");
        if (mounted) setPoints(normalized);
      } catch (_e) {
        if (mounted) { setPoints([]); setPointsErr("Không tải được điểm nhận. Bạn vẫn có thể đăng ký, chúng tôi sẽ liên hệ xác nhận."); }
      } finally { if (mounted) setLoadingPoints(false); }
    })();
    return () => { mounted = false; };
  }, [open, gateways]);

  const nearest = useMemo(() => {
    if (!points?.length) return [];
    const origin = myLoc || null;
    return points
      .map((p) => ({ ...p, _distance: origin ? haversineKm(origin, p) : null }))
      .sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity))
      .slice(0, 8);
  }, [points, myLoc]);

  const getMyLocation = useCallback(() => {
    setGeoErr("");
    if (!navigator?.geolocation) { setGeoErr("Trình duyệt không hỗ trợ Geolocation."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const crd = pos?.coords; if (crd) setMyLoc({ lat: crd.latitude, lng: crd.longitude }); },
      (err) => setGeoErr(err?.message || "Không lấy được vị trí."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  async function createMealPayment() {
    try {
      setPayErr(""); setPaying(true); setQr({ img: "", svg: "" });
      const amount = Number(mealsMoney || 0) * Number(mealPrice || 0);
      if (!amount || amount < mealPrice) { setPayErr("Số bữa không hợp lệ."); return; }

      const m = (method || "").toLowerCase();
      if (m === "custom_qr") {
        const img = campaign?.payment?.qr_url || "";
        if (!img) throw new Error("Chiến dịch chưa cấu hình QR.");
        setQr({ img, svg: "" }); return;
      }
      if (m === "vietqr") {
        const img = campaign?.payment?.qr_url || buildVietQRUrl({
          bank: campaign?.payment?.bank, account: campaign?.payment?.account, name: campaign?.payment?.name, memo: campaign?.payment?.memo, amount,
        });
        if (!img) throw new Error("Không tạo được QR VietQR (thiếu bank/account).");
        setQr({ img, svg: "" }); return;
      }

      const resp = await createPayment({
        method: m, amount, campaign_id: campaign?.id, orderInfo: `Ủng hộ ${mealsMoney} bữa ăn (${mealPrice.toLocaleString("vi-VN")}đ/bữa)`,
      });

      if (resp?.pay_url) { window.location.href = resp.pay_url; return; }
      if (resp?.qr_image || resp?.qr_svg) { setQr({ img: resp.qr_image || "", svg: resp.qr_svg || "" }); return; }
      setPayErr("Chưa nhận được liên kết thanh toán/QR.");
    } catch (e) {
      setPayErr(e?.message || "Không tạo được thanh toán.");
    } finally { setPaying(false); }
  }

  async function registerInKind(pointId) {
    try {
      setSubmittingKind(true); setSubmitMsg("");
      const body = { campaign_id: campaign?.id, servings: Number(mealsKind || 0), pickup_point_id: pointId, in_kind: true, user_location: myLoc || undefined };
      const res = await apiPost("/api/meals/donate", body).catch((e) => ({ ok: false, message: e?.message }));
      if (res?.ok) setSubmitMsg("Đăng ký gửi bữa thành công! Vui lòng mang tới điểm tập trung đã chọn.");
      else setSubmitMsg(res?.message || "Đã gửi yêu cầu. Chúng tôi sẽ liên hệ xác nhận.");
    } finally { setSubmittingKind(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overscroll-contain">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-start gap-3">
          <div className="flex-1">
            <div className="text-lg font-bold">Ủng hộ bữa ăn</div>
            <div className="text-sm text-slate-700 line-clamp-2">{campaign?.title}</div>
          </div>
          <Btn variant="ghost" onClick={onClose}>Đóng</Btn>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex rounded-xl border border-slate-300 bg-white overflow-hidden">
            <button onClick={() => setTab("money")} className={["px-4 py-2 text-sm transition", tab === "money" ? "bg-emerald-600 text-white" : "hover:bg-slate-50"].join(" ")}>Tài trợ tiền</button>
            <button onClick={() => setTab("in_kind")} className={["px-4 py-2 text-sm border-l border-slate-300 transition", tab === "in_kind" ? "bg-emerald-600 text-white" : "hover:bg-slate-50"].join(" ")}>Gửi bữa đến điểm tập trung</button>
          </div>
        </div>

        {tab === "money" ? (
          <div className="p-5 space-y-5">
            <Card className="p-4">
              <div className="text-sm text-slate-700">Số bữa (mỗi bữa {mealPrice.toLocaleString("vi-VN")}đ)</div>
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" min={1} step={1} value={mealsMoney} onChange={(e) => setMealsMoney(e.target.value)} className="w-40" />
                <div className="flex gap-2">
                  {[5, 10, 20, 50].map((v) => (
                    <button key={v} type="button" onClick={() => setMealsMoney(v)}
                      className={["px-3 py-1 rounded-xl border transition", Number(mealsMoney) === v ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white hover:bg-slate-50"].join(" ")}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-sm">
                Tổng tiền: <b className="text-emerald-700">{(Number(mealsMoney || 0) * Number(mealPrice || 0)).toLocaleString("vi-VN")} đ</b>
              </div>
            </Card>

            <Card className="p-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {gateways.map((g) => <option key={g.code} value={g.code}>{g.name || g.code}</option>)}
                  </Select>
                  <div className="mt-1 text-xs text-slate-500">
                    {campaign?.payment_method ? `Cấu hình của chiến dịch: ${campaign.payment_method}` : "Mặc định MoMo nếu không cấu hình riêng."}
                  </div>
                </div>
                <div className="flex items-end">
                  <Btn className="w-full" onClick={createMealPayment} disabled={paying || !method || Number(mealsMoney) <= 0}>
                    {paying ? "Đang tạo thanh toán…" : "Ủng hộ bằng tiền"}
                  </Btn>
                </div>
              </div>

              {payErr ? <div className="mt-2 text-sm text-rose-600">{payErr}</div> : null}
              {(qr.img || qr.svg) && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {qr.svg ? <div className="w-56 h-56 bg-white rounded-xl p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} /> :
                    <img src={qr.img} alt="QR" className="w-56 h-56 object-contain bg-white rounded-xl p-2" />}
                  <div className="text-xs text-slate-500">Quét QR để thanh toán</div>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <Card className="p-4">
              <div className="text-sm text-slate-700">Số bữa bạn sẽ gửi</div>
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" min={1} step={1} value={mealsKind} onChange={(e) => setMealsKind(e.target.value)} className="w-40" />
                <div className="flex gap-2">
                  {[5, 10, 20, 50].map((v) => (
                    <button key={v} type="button" onClick={() => setMealsKind(v)}
                      className={["px-3 py-1 rounded-xl border transition", Number(mealsKind) === v ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white hover:bg-slate-50"].join(" ")}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-600">Bạn sẽ chủ động mang bữa tới điểm tập trung phù hợp. Chúng tôi sẽ xác nhận khi nhận được.</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-800">Chọn điểm tập trung để gửi bữa</div>
                  <div className="text-xs text-slate-500">Bấm <b>Lấy vị trí của tôi</b> để sắp theo khoảng cách.</div>
                </div>
                <Btn variant="ghost" onClick={getMyLocation}>Lấy vị trí của tôi</Btn>
              </div>
              {geoErr ? <div className="mt-2 text-sm text-amber-700">{geoErr}</div> : null}

              <div className="mt-3">
                {loadingPoints ? (
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                    Đang tải điểm tập trung…
                  </div>
                ) : pointsErr ? (
                  <div className="text-sm text-amber-700">{pointsErr}</div>
                ) : !points?.length ? (
                  <div className="text-sm text-slate-600">Chưa có điểm tập trung khả dụng.</div>
                ) : (
                  <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden">
                    {nearest.map((p) => {
                      const gmaps = p.lat != null && p.lng != null
                        ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address || p.name)}`;
                      return (
                        <li key={p.id} className="p-3 sm:p-4 bg-white hover:bg-slate-50 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                              <div className="text-sm text-slate-700 truncate">{p.address}</div>
                              <div className="text-xs text-slate-500">{p.open_hours ? `Giờ mở cửa: ${p.open_hours}` : "Giờ mở cửa: cập nhật sau"}</div>
                              <div className="text-xs text-slate-500">{p._distance != null && isFinite(p._distance) ? `${p._distance.toFixed(2)} km` : "Khoảng cách: —"}</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <a href={gmaps} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 text-slate-800" title="Chỉ đường">Chỉ đường</a>
                              <Btn onClick={() => registerInKind(p.id)} disabled={submittingKind || Number(mealsKind) <= 0}>Đăng ký gửi bữa</Btn>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {submitMsg ? <div className="mt-3 text-sm text-emerald-700">{submitMsg}</div> : null}
            </Card>
          </div>
        )}

        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Đóng</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================ Supporters Modal ============================ */
async function fetchSupportersFlexible(campaignId) {
  try { const r1 = await apiGet(`/api/campaigns/${campaignId}/supporters`); if (r1) return r1.items ?? r1.value ?? r1.data ?? r1; } catch {}
  try { const r2 = await apiGet(`/api/campaigns/${campaignId}/donations?page=1&pageSize=200`); if (r2) return r2.items ?? r2.value ?? r2.data ?? r2; } catch {}
  try { const r3 = await apiGet(`/api/donations?campaign_id=${encodeURIComponent(campaignId)}&page=1&pageSize=200`); if (r3) return r3.items ?? r3.value ?? r3.data ?? r3; } catch {}
  try { const r4 = await apiGet(`/api/campaigns/${campaignId}/contributions?page=1&pageSize=200`); if (r4) return r4.items ?? r4.value ?? r4.data ?? r4; } catch {}
  return [];
}
function normalizeSupporter(x) {
  const amount = toNum(x.amount ?? x.value ?? x.money ?? x.total, 0);
  const name = (x.name ?? x.full_name ?? x.display_name ?? x.user_name ?? "Ẩn danh").toString();
  const message = x.message ?? x.note ?? x.memo ?? "";
  const at = x.created_at ?? x.paid_at ?? x.time ?? x.date ?? x.updated_at ?? null;
  const anon = Boolean(x.anonymous ?? x.is_anonymous);
  const avatar = x.avatar_url ?? x.avatar ?? "";
  return { id: x.id ?? x.donation_id ?? Math.random().toString(36).slice(2), name, message, amount, at, anonymous: anon, avatar };
}
const Avatar = ({ name = "?", src }) =>
  src ? (
    <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover border border-slate-200" />
  ) : (
    <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-bold">
      {(name || "?").split(" ").map(s => s[0]).filter(Boolean).slice(0,2).join("").toUpperCase() || "?"}
    </div>
  );

function SupportersModal({ open, onClose, campaign }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    if (!open || !campaign?.id) return;
    let mounted = true;
    setLoading(true); setErr(""); setItems([]);
    (async () => {
      try {
        const raw = await fetchSupportersFlexible(campaign.id);
        let arr = Array.isArray(raw) ? raw : raw?.items ?? [];
        if (!Array.isArray(arr)) arr = [];
        const normalized = arr.map(normalizeSupporter);
        if (mounted) setItems(normalized);
      } catch (e) { if (mounted) setErr(e?.message || "Không tải được danh sách ủng hộ."); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [open, campaign?.id]);

  const total = useMemo(() => items.reduce((s, x) => s + (x.amount || 0), 0), [items]);
  const view = useMemo(() => {
    let arr = items.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((x) => (x.name || "").toLowerCase().includes(s) || (x.message || "").toLowerCase().includes(s));
    }
    if (sort === "newest") arr.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    else if (sort === "amount") arr.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    return arr;
  }, [items, q, sort]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overscroll-contain">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="text-lg font-bold">Chi tiết ủng hộ</div>
          <div className="text-sm text-slate-700 line-clamp-2">{campaign?.title}</div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="text-xs text-slate-600">Tổng số tiền</div>
              <div className="text-lg font-bold text-emerald-700">{total.toLocaleString("vi-VN")} đ</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-slate-600">Số lượt ủng hộ</div>
              <div className="text-lg font-bold text-slate-900">{items.length.toLocaleString("vi-VN")}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-slate-600">Tiến độ hiện tại</div>
              <div className="text-lg font-bold text-slate-900">
                {(toNum(campaign?.raised_amount ?? campaign?.raised, 0)).toLocaleString("vi-VN")} đ
                {campaign?.target_amount ? <> / {toNum(campaign?.target_amount, 0).toLocaleString("vi-VN")} đ</> : null}
              </div>
            </Card>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input placeholder="Tìm theo tên hoặc ghi chú…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select className="w-full sm:w-52" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="amount">Số tiền (cao → thấp)</option>
            </Select>
          </div>
        </div>

        <div className="p-5 max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-700">
              <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
              Đang tải danh sách ủng hộ…
            </div>
          ) : err ? (
            <div className="text-sm text-rose-600">{err}</div>
          ) : view.length === 0 ? (
            <div className="text-sm text-slate-600">Chưa có dữ liệu ủng hộ.</div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden bg-white">
              {view.map((x) => (
                <li key={x.id} className="p-3 sm:p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start gap-3">
                    <Avatar name={x.anonymous ? "Ẩn danh" : x.name} src={x.avatar} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="font-medium text-slate-900 truncate">{x.anonymous ? "Ẩn danh" : x.name}</div>
                        <div className="text-xs text-slate-500">{x.at ? new Date(x.at).toLocaleString("vi-VN") : ""}</div>
                      </div>
                      {x.message ? <div className="text-sm text-slate-700 mt-0.5 break-words">{x.message}</div> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-emerald-700 font-semibold">{toNum(x.amount, 0).toLocaleString("vi-VN")} đ</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Đóng</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================ Page ============================ */
export default function Campaigns() {
  const location = useLocation();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filters, setFilters] = useState({ diet: false, expiring: false, activeOnly: false });

  const [gateways, setGateways] = useState([]);
  const [gwErr, setGwErr] = useState("");
  const [mealPrice, setMealPrice] = useState(10000);

  const [donateMoneyOpen, setDonateMoneyOpen] = useState(false);
  const [donateMealOpen, setDonateMealOpen] = useState(false);
  const [supportersOpen, setSupportersOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const [qDebounced, setQDebounced] = useState("");
  const typingTimer = useRef(null);

  /* ========== KHẮC PHỤC “2 THANH SCROLL” CHỈ Ở TRANG NÀY ========== */
  useEffect(() => {
    // khóa scroll của <html> & <body>, chỉ để main (Layout) cuộn
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflowY;
    const prevBody = body.style.overflowY;
    html.style.overflowY = "hidden";
    body.style.overflowY = "hidden";
    return () => {
      html.style.overflowY = prevHtml || "";
      body.style.overflowY = prevBody || "";
    };
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(typingTimer.current);
  }, [q]);

  // Load campaigns
  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();
    (async () => {
      try {
        setErr(""); setLoading(true);
        const data = await apiGet("/api/campaigns?status=active&page=1&pageSize=1000", { signal: ac.signal });
        if (!isMounted) return;
        const arr = Array.isArray(data) ? data : data.items || [];
        setRaw(arr.map(normalizeCampaign));
      } catch (e) {
        if (e?.name !== "AbortError") { setErr(e?.message || "Không thể tải danh sách chiến dịch."); setRaw([]); }
      } finally { if (isMounted) setLoading(false); }
    })();
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch {}
    return () => { isMounted = false; ac.abort(); };
  }, [location.key]);

  // Gateways + meal price
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setGwErr("");
        let gws = await apiGet("/api/payments/gateways").catch(() => null);
        if (!gws) {
          const s = await apiGet("/api/site-settings?key=payment_gateways").catch(() => null);
          gws = s?.value || s?.items || [];
        }
        if (!Array.isArray(gws)) gws = [];
        gws = gws
          .map((x) => (typeof x === "string" ? { code: x, name: x } : x))
          .filter((x) => x && (x.enabled === undefined || x.enabled))
          .map((x) => ({ ...x, code: (x.code || "").toLowerCase() }));
        if (gws.length === 0) gws = [{ code: "momo", name: "MoMo (Sandbox)" }];
        if (mounted) setGateways(gws);

        const feeRes = await apiGet("/api/site-settings?key=meal_price_vnd").catch(() => null);
        const v = Number(feeRes?.value ?? feeRes?.items ?? 10000);
        if (mounted && Number.isFinite(v) && v > 0) setMealPrice(v);
      } catch (_) {
        if (mounted) {
          setGateways([{ code: "momo", name: "MoMo (Sandbox)" }]);
          setGwErr("Không lấy được cấu hình cổng thanh toán. Dùng mặc định MoMo.");
          setMealPrice(10000);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const list = useMemo(() => {
    const pct = (c) => {
      const raised = Number(c.raised || c.raised_amount || 0);
      const goal = Number(c.goal || c.target_amount || 0);
      return Math.min(100, Math.round((raised / (goal || 1)) * 100));
    };
    const daysLeft = (c) => (c.deadline ? Math.ceil((new Date(c.deadline) - new Date()) / 86400000) : Infinity);

    let arr = [...raw];
    if (qDebounced) {
      const s = qDebounced.toLowerCase();
      arr = arr.filter((c) => {
        const inTitle = (c.title || "").toLowerCase().includes(s);
        const inDesc = (c.description || "").toLowerCase().includes(s);
        const inTags = (c.tags || []).some((t) => String(t).toLowerCase().includes(s));
        const inLoc = (c.location || "").toLowerCase().includes(s);
        return inTitle || inDesc || inTags || inLoc;
      });
    }
    if (filters.activeOnly) arr = arr.filter((c) => (c.status || "active") === "active");
    if (filters.diet) arr = arr.filter((c) => (c.tags || []).some((t) => String(t).toLowerCase().includes("chay")));
    if (filters.expiring) {
      arr = arr
        .slice()
        .sort((a, b) => {
          const da = daysLeft(a);
          const db = daysLeft(b);
          if (da !== db) return da - db;
          return pct(a) - pct(b);
        });
    }
    if (sortBy === "progress") arr = arr.slice().sort((a, b) => pct(b) - pct(a));
    else if (sortBy === "supporters") arr = arr.slice().sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    else if (sortBy === "endingSoon") arr = arr.slice().sort((a, b) => daysLeft(a) - daysLeft(b));
    else if (sortBy === "newest") arr = arr.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return arr;
  }, [raw, qDebounced, filters, sortBy]);

  function openDonate(campaign) {
    setSelectedCampaign(campaign);
    if (isMealCampaign(campaign)) setDonateMealOpen(true);
    else setDonateMoneyOpen(true);
  }
  function openSupporters(campaign) {
    setSelectedCampaign(campaign);
    setSupportersOpen(true);
  }

  // Totals
  const totalSupporters = useMemo(() => raw.reduce((a, c) => a + (c.supporters || 0), 0), [raw]);
  const totalRaised = useMemo(() => raw.reduce((a, c) => a + (Number(c.raised) || Number(c.raised_amount) || 0), 0), [raw]);
  const totalMeals = useMemo(() => raw.reduce((a, c) => a + (Number(c.meta?.meal?.received_qty) || 0), 0), [raw]);

  return (
    <div className="space-y-6 subpixel-antialiased [text-rendering:optimizeLegibility] overflow-x-hidden min-h-0">
      {/* Banner nhẹ rực rỡ */}
      <div className="rounded-2xl border p-4 md:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-emerald-100">
        <div className="text-xl font-extrabold text-slate-900">Chiến dịch</div>
        <div className="mt-1 text-sm text-slate-600">Tìm kiếm, lọc và ủng hộ các chiến dịch đang hoạt động.</div>
      </div>

      {/* Toolbar */}
      <Card className="p-4 ring-1 ring-transparent hover:ring-emerald-100 transition">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1 font-semibold text-slate-900">Bộ lọc & sắp xếp</div>
          <div className="flex gap-2 flex-wrap items-center">
            <Input className="w-64" placeholder="Tìm theo tiêu đề, mô tả, tag, địa điểm…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="progress">Tiến độ</option>
              <option value="supporters">Nhiều ủng hộ</option>
              <option value="endingSoon">Sắp kết thúc</option>
            </Select>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.activeOnly} onChange={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))} />
              Chỉ hiển thị đang hoạt động
            </label>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.diet} onChange={() => setFilters((f) => ({ ...f, diet: !f.diet }))} />
              Ăn chay
            </label>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.expiring} onChange={() => setFilters((f) => ({ ...f, expiring: !f.expiring }))} />
              Sắp hết hạn
            </label>
          </div>
        </div>
        {gwErr ? <div className="mt-2 text-sm text-amber-700">{gwErr}</div> : null}
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Người ủng hộ" value={totalSupporters.toLocaleString("vi-VN")} />
        <Stat label="Đã gây quỹ" value={totalRaised.toLocaleString("vi-VN") + " đ"} />
        <Stat label="Khẩu phần" value={totalMeals.toLocaleString("vi-VN")} />
        <Stat label="Chiến dịch" value={raw.length} />
      </div>

      {/* Body */}
      {err ? (
        <Card className="p-8 text-center text-rose-600">{err}</Card>
      ) : loading ? (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : list.length === 0 ? (
        <Card className="p-8 text-center text-slate-600">Chưa có chiến dịch phù hợp.</Card>
      ) : (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 isolate">
          {list.map((c) => (
            <div key={c.id} className="relative">
              {/* Card campaign đang dùng của bạn */}
              <CampaignCard c={c} onDonate={openDonate} />
              {/* ❌ ĐÃ BỎ nút “Người ủng hộ” thừa ở đây để không lặp action */}
              {/* Nếu muốn mở modal người ủng hộ từ trong card: gọi onSupporters ở trong component CampaignCard */}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <DonateMoneyModal open={donateMoneyOpen} onClose={() => setDonateMoneyOpen(false)} campaign={selectedCampaign} globalGateways={gateways} />
      <DonateMealModal open={donateMealOpen} onClose={() => setDonateMealOpen(false)} campaign={selectedCampaign} globalGateways={gateways} mealPrice={mealPrice} />
      <SupportersModal open={supportersOpen} onClose={() => setSupportersOpen(false)} campaign={selectedCampaign} />
    </div>
  );
}
