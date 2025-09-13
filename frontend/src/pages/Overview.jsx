// --- Overview.jsx (contrast + radio-pill + focus ring, polished) ---
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import {
  Users, Soup, HandHeart, Megaphone, ArrowRight, MapPin,
  Calendar, Target, Timer, AlertTriangle, Sparkles, Filter, Gauge
} from "lucide-react";

/* ============== Small UI bits ============== */
function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl
                           bg-emerald-200/70 text-emerald-800 border border-emerald-300 shadow-sm">
            <Icon size={18}/>
          </span>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{children}</h2>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 rounded-2xl
                    border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
      <div className="relative p-2.5 rounded-xl bg-emerald-100 ring-1 ring-emerald-300">
        <Icon size={20} className="text-emerald-700" />
      </div>
      <div className="space-y-0.5">
        <div className="text-xs uppercase tracking-wide text-slate-700">{label}</div>
        <div className="text-2xl md:text-[26px] font-bold tabular-nums text-slate-900">
          {value}
        </div>
      </div>
    </div>
  );
}

function GradientCard({ children, className = "" }) {
  return (
    <div className={"relative rounded-3xl p-[1.5px] bg-[conic-gradient(at_20%_-10%,#34d39940,transparent_20%,#38bdf840_60%,transparent_80%)] " + className}>
      <Card className="rounded-[calc(theme(borderRadius.3xl)-2px)] overflow-hidden border border-slate-200 bg-white">
        {children}
      </Card>
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-sky-600 transition-[width] duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* Radio pill (không mờ, contrast tốt) */
function RadioPill({ name, value, checked, onChange, children }) {
  return (
    <label className="radio">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer"
      />
      <span className="radio-pill">
        <span className="radio-dot" />
        <span className="radio-label">{children}</span>
      </span>
    </label>
  );
}

function FeaturedCard({ c }) {
  const cover = c.cover?.length > 4
    ? c.cover
    : "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1200&auto=format&fit=crop";
  const pct = Math.round(((c.raised ?? 0) / (c.goal || 1)) * 100);

  return (
    <div className="group">
      <GradientCard>
        <div className="relative">
          <div className="aspect-[16/9] overflow-hidden">
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
          {c.location && (
            <span className="absolute top-3 left-3 bg-black/65 text-white text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 backdrop-blur">
              <MapPin size={12}/> {c.location}
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg md:text-xl font-semibold leading-tight line-clamp-1 text-slate-900">
              {c.title || "Chiến dịch"}
            </h3>
            {pct >= 90 && <Badge tone="emerald" className="ml-auto">Sắp đạt</Badge>}
          </div>

          <p className="text-[15px] text-slate-800 line-clamp-2">{c.description || "—"}</p>

          <ProgressBar pct={pct}/>
          <div className="text-sm text-slate-800 flex items-center justify-between">
            <span>
              Gây quỹ: <b className="text-slate-900">{(c.raised ?? 0).toLocaleString("vi-VN")}đ</b> /
              {" "}{(c.goal ?? 0).toLocaleString("vi-VN")}đ
            </span>
            {c.deadline && (
              <span className="flex items-center gap-1 text-slate-900">
                <Calendar size={14}/> {new Date(c.deadline).toLocaleDateString("vi-VN")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(c.tags || []).slice(0, 3).map((t) => (
              <span key={t} className="inline-flex px-2 py-0.5 rounded-lg text-xs bg-slate-100 text-slate-900 border border-slate-200">#{t}</span>
            ))}
            {typeof c.impact_meals === "number" && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs
                                bg-sky-100 text-sky-900 border border-sky-200">
                <Soup size={12}/> {c.impact_meals.toLocaleString("vi-VN")} bữa
              </span>
            )}
          </div>
        </div>
      </GradientCard>
    </div>
  );
}

/* Count-up */
function useCountUp(target = 0, durationMs = 1200) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = 0; fromRef.current = val;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setVal(next);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return val;
}

/* Simple Toast */
function Toast({ toast, onClose }) {
  if (!toast?.show) return null;
  const tone = toast.type || "success";
  const map = {
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger:  "bg-rose-50 text-rose-900 border-rose-200",
    info:    "bg-sky-50 text-sky-900 border-sky-200",
  };
  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className={`max-w-sm rounded-2xl border px-4 py-3 shadow-md ${map[tone]}`}>
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5"/>
          <div className="text-[15px] leading-relaxed">{toast.message}</div>
          <button className="ml-1 text-slate-600 hover:text-slate-800" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}

/* ============== Page ============== */
export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [featured, setFeatured] = useState({ items: [], total: 0 });
  const [loadingFeat, setLoadingFeat] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  // Reco
  const [latlng, setLatlng] = useState({ lat: null, lng: null });
  const [maxKm, setMaxKm] = useState(5);
  const [dietPref, setDietPref] = useState("any");
  const [personalize, setPersonalize] = useState(true);
  const [recoSort, setRecoSort] = useState("priority");
  const [reco, setReco] = useState({ items: [], ok: true, msg: "" });
  const [loadingReco, setLoadingReco] = useState(false);
  const [pickup, setPickup] = useState({ ok: true, windows: [], hubs: [], msg: "" });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    (async () => {
      setLoadingStats(true);
      try { setStats(await apiGet("/api/overview") || {}); }
      catch { setStats({}); }
      finally { setLoadingStats(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingFeat(true);
      try {
        let res = await apiGet("/api/campaigns?featured=1&pageSize=6");
        if (!res?.items?.length) res = await apiGet("/api/campaigns?page=1&pageSize=6");
        setFeatured(res || { items: [], total: 0 });
      } catch { setFeatured({ items: [], total: 0 }); }
      finally { setLoadingFeat(false); }
    })();
  }, []);

  const mealsGiven = useMemo(() => {
    const m = stats?.meals_given ?? stats?.meals ?? stats?.distributed_meals ?? 0;
    return Number.isFinite(m) ? m : 0;
  }, [stats]);
  const donors = stats?.donors ?? 0;
  const recipients = stats?.recipients ?? 0;
  const campaigns = stats?.campaigns ?? stats?.active_campaigns ?? 0;
  const heroCount = useCountUp(mealsGiven, 1200);

  const showToast = (message, type = "success") => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  };

  function getLocation() {
    if (!navigator.geolocation) { showToast("Trình duyệt không hỗ trợ định vị.", "warning"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude }); showToast("Đã lấy vị trí của bạn.", "info"); },
      () => showToast("Không lấy được vị trí. Hãy cấp quyền định vị.", "warning")
    );
  }

  async function fetchRecommendations() {
    setLoadingReco(true);
    try {
      const qs = new URLSearchParams({
        lat: latlng.lat ?? "", lng: latlng.lng ?? "", maxKm: String(maxKm || ""),
        diet: dietPref, personalize: String(personalize), sort: recoSort, limit: "9",
      }).toString();
      const data = await apiGet(`/api/reco/foods?${qs}`);
      setReco({ items: Array.isArray(data) ? data : [], ok: true, msg: "" });
      showToast("Đã cập nhật gợi ý phù hợp.", "info");
    } catch {
      setReco({ items: [], ok: false, msg: "Không lấy được gợi ý." });
      showToast("Không lấy được gợi ý. Thử lại sau.", "danger");
    } finally { setLoadingReco(false); }
  }

  async function fetchPickup() {
    try {
      if (!latlng.lat || !latlng.lng) {
        setPickup({ ok: false, windows: [], hubs: [], msg: "Chưa có vị trí để gợi ý." });
        showToast("Hãy bấm Lấy vị trí trước.", "warning");
        return;
      }
      const data = await apiGet(`/api/reco/pickup?lat=${latlng.lat}&lng=${latlng.lng}`);
      setPickup({ ok: true, windows: data?.windows || [], hubs: data?.hubs || [], msg: "" });
      showToast("Đã gợi ý khung giờ & điểm hẹn.", "info");
    } catch {
      setPickup({ ok: false, windows: [], hubs: [], msg: "Không lấy được gợi ý điểm hẹn." });
      showToast("Không lấy được gợi ý điểm hẹn.", "danger");
    }
  }

  return (
    <>
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      {/* aura */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-20 -left-16 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-30 bg-emerald-200" />
        <div className="absolute -bottom-24 -right-20 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25 bg-sky-200" />
      </div>

      {/* HERO */}
      <section className={`mb-8 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
        <GradientCard>
          <div className="relative p-7 md:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-7">
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <HandHeart size={18}/> Cùng nhau giảm lãng phí – lan toả yêu thương
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
                Đã kết nối <span className="text-emerald-700">bữa ăn</span> tới cộng đồng
              </h1>
              <div className="mt-4 mb-1 text-7xl md:text-8xl font-black leading-none tabular-nums text-slate-900 drop-shadow-sm">
                {loadingStats ? "…" : heroCount.toLocaleString("vi-VN")}
              </div>
              <div className="text-lg text-slate-800">bữa ăn đã được cho đi</div>
              <div className="mt-6 flex items-center gap-3">
                <Button onClick={() => (window.location.href = "/campaigns")} className="shadow-sm hover:shadow">
                  Tham gia ủng hộ <ArrowRight size={16} className="ml-1"/>
                </Button>
                <Button variant="outline" onClick={() => (window.location.href = "/reports")} className="hover:bg-white">
                  Xem tác động
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full lg:w-[26rem]">
              <StatChip icon={Users} label="Nhà hảo tâm" value={donors.toLocaleString("vi-VN")}/>
              <StatChip icon={HandHeart} label="Người nhận" value={recipients.toLocaleString("vi-VN")}/>
              <StatChip icon={Megaphone} label="Chiến dịch đang chạy" value={campaigns.toLocaleString("vi-VN")}/>
              <StatChip icon={Soup} label="Tổng bữa tặng" value={mealsGiven.toLocaleString("vi-VN")}/>
            </div>
          </div>
        </GradientCard>
      </section>

      {/* Toolbar */}
      <GradientCard className="mb-4">
        <div className="p-5">
          <SectionTitle icon={Filter}>Gợi ý cho bạn</SectionTitle>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={getLocation} className="hover:bg-white">
                <MapPin size={16} className="mr-2"/> Lấy vị trí
              </Button>
              <div className="text-sm text-slate-800">
                {latlng.lat ? <>({latlng.lat.toFixed(4)}, {latlng.lng?.toFixed(4)})</> : <>Chưa có vị trí</>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-800">Bán kính</label>
              <div className="relative w-44">
                <input
                  type="range" min={1} max={20} value={maxKm}
                  onChange={(e)=>setMaxKm(Number(e.target.value))}
                  className="w-full appearance-none bg-transparent relative z-10"
                />
                <div className="pointer-events-none absolute inset-y-1.5 left-0 right-0 rounded-full bg-slate-200"/>
                <div
                  className="pointer-events-none absolute inset-y-1.5 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-sky-600"
                  style={{ width: `${(maxKm / 20) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm tabular-nums text-slate-900">{maxKm}km</div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-800">Chế độ ăn</label>
              <select
                className="select"
                value={dietPref}
                onChange={(e)=>setDietPref(e.target.value)}
              >
                <option value="any">Bất kỳ</option>
                <option value="chay">Ăn chay</option>
                <option value="halal">Halal</option>
                <option value="kythit">Kỵ thịt</option>
                <option value="none">Không ưu tiên</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm ml-auto cursor-pointer select-none text-slate-900">
              <input
                type="checkbox"
                checked={personalize}
                onChange={()=>setPersonalize(!personalize)}
                className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-300"
              />
              Cá nhân hoá từ lịch sử
            </label>

            <Button onClick={fetchRecommendations} className="ml-2">Lấy gợi ý</Button>
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="text-sm text-slate-800">Xếp hạng ưu tiên:</div>
            {[
              { v: "priority", label: "Tổng hợp (trọng số)" },
              { v: "expireSoon", label: "Gần hết hạn" },
              { v: "dietMatch", label: "Phù hợp chế độ ăn" },
            ].map((o) => (
              <RadioPill
                key={o.v}
                name="recoSort"
                value={o.v}
                checked={recoSort === o.v}
                onChange={() => setRecoSort(o.v)}
              >
                {o.label}
              </RadioPill>
            ))}
          </div>
        </div>
      </GradientCard>

      {/* Recommendation result */}
      {loadingReco ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-slate-100 rounded-3xl"/>)}
        </div>
      ) : !reco.ok ? (
        <GradientCard className="mb-6">
          <div className="p-3 flex items-center gap-2 text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle size={18}/> <span>{reco.msg}</span>
          </div>
        </GradientCard>
      ) : reco.items.length > 0 ? (
        <>
          <SectionTitle icon={Sparkles} right={<div className="text-sm text-slate-800">{reco.items.length} mục</div>}>
            Gợi ý cho bạn
          </SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {reco.items.map((it) => <FoodCard key={it.id} item={it}/>)}
          </div>
        </>
      ) : null}

      {/* Pickup & hubs */}
      <GradientCard className="mb-6">
        <div className="p-5">
          <SectionTitle icon={Gauge} right={<Button variant="outline" className="hover:bg-white" onClick={fetchPickup}>Gợi ý ngay</Button>}>
            Gợi ý khung giờ & điểm hẹn tối ưu
          </SectionTitle>
          {!pickup.ok && pickup.msg ? (
            <div className="text-sm text-amber-900 flex items-center gap-2"><AlertTriangle size={16}/> {pickup.msg}</div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4 rounded-2xl">
                <div className="text-sm text-slate-800 mb-2">Khung giờ gợi ý</div>
                {pickup.windows?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {pickup.windows.map((w,i)=>(
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs
                                              bg-emerald-100 text-emerald-900 border border-emerald-200">
                        <Timer size={12}/> {w}
                      </span>
                    ))}
                  </div>
                ) : <div className="text-sm text-slate-600">Chưa có dữ liệu.</div>}
              </Card>

              <Card className="p-4 rounded-2xl">
                <div className="text-sm text-slate-800 mb-2">Điểm hẹn/Hubs gần</div>
                {pickup.hubs?.length ? (
                  <ul className="text-sm list-disc ml-5 space-y-1 text-slate-900">
                    {pickup.hubs.map((h)=>(
                      <li key={h.id}>
                        <span className="font-semibold">{h.name}</span>{" "}
                        {typeof h.distance_km==="number" && <span className="text-slate-700">({h.distance_km.toFixed(1)} km)</span>}
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-sm text-slate-600">Chưa có dữ liệu.</div>}
              </Card>
            </div>
          )}
        </div>
      </GradientCard>

      {/* Mission */}
      <section className="mb-6">
        <GradientCard>
          <div className="p-6 bg-gradient-to-br from-emerald-50 to-sky-50 rounded-[calc(theme(borderRadius.3xl)-2px)]">
            <div className="flex items-start gap-3">
              <Target size={20} className="mt-0.5 text-emerald-700"/>
              <div>
                <div className="text-lg font-semibold text-slate-900">Sứ mệnh</div>
                <p className="text-[15px] text-slate-800 mt-1">
                  Bữa Cơm Xanh kết nối thức ăn còn tốt từ nhà hảo tâm đến người cần, đảm bảo an toàn – minh bạch – kịp thời.
                </p>
              </div>
            </div>
          </div>
        </GradientCard>
      </section>

      {/* Featured campaigns */}
      <SectionTitle
        icon={Megaphone}
        right={<Button variant="ghost" onClick={() => (window.location.href = "/campaigns")}>Xem tất cả <ArrowRight size={14} className="ml-1"/></Button>}
      >
        Chiến dịch tiêu biểu
      </SectionTitle>

      {loadingFeat ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-slate-100 rounded-3xl"/>)}
        </div>
      ) : featured.items.length === 0 ? (
        <Empty title="Chưa có chiến dịch" hint="Hãy quay lại sau hoặc khám phá các mục khác." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.items.map((c) => <FeaturedCard key={c.id} c={c}/>)}
        </div>
      )}
    </>
  );
}

/* Food card */
function FoodCard({ item }) {
  const cover = item.images?.[0] || "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop";
  const km = typeof item.distance_km === "number" ? item.distance_km : null;
  const score = typeof item.reco_score === "number" ? Math.round(item.reco_score * 100) : null;
  const hoursLeft = item.expire_at ? Math.max(0, Math.ceil((new Date(item.expire_at) - new Date()) / 3600000)) : null;
  const dietMatch = item.diet_match === true;

  return (
    <div className="group">
      <GradientCard>
        <div className="overflow-hidden rounded-[calc(theme(borderRadius.3xl)-2px)]">
          <div className="relative aspect-[16/10]">
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <div className="absolute left-2 top-2 flex gap-2">
              {dietMatch && <span className="inline-flex px-2 py-0.5 rounded-lg text-xs bg-emerald-100 text-emerald-900 border border-emerald-200">Phù hợp chế độ ăn</span>}
              {score !== null && <span className="inline-flex px-2 py-0.5 rounded-lg text-xs bg-sky-100 text-sky-900 border border-sky-200">score {score}</span>}
            </div>
          </div>

          <div className="p-4 space-y-2">
            <div className="font-semibold text-[15.5px] line-clamp-1 text-slate-900">{item.title}</div>
            <div className="text-[14.5px] text-slate-800 line-clamp-2">{item.description}</div>
            <div className="text-sm text-slate-900">
              Còn <b className="tabular-nums">{item.qty}</b> {item.unit}
              {item.expire_at && <> • HSD {new Date(item.expire_at).toLocaleString("vi-VN")}</>}
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {(item.tags || []).slice(0, 4).map((t) => (
                <span key={t} className="inline-flex px-2 py-0.5 rounded-lg text-xs bg-slate-100 text-slate-900 border border-slate-200">#{t}</span>
              ))}
              {km !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-slate-100 text-slate-900 border border-slate-200">
                  <MapPin size={12}/> {km.toFixed(1)} km
                </span>
              )}
              {hoursLeft !== null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border
                                  ${hoursLeft <= 12 ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-slate-100 text-slate-900 border-slate-200"}`}>
                  <Timer size={12}/> còn ~{hoursLeft}h
                </span>
              )}
            </div>

            <div className="text-xs text-slate-700">{item.location_addr ? <>Địa điểm: {item.location_addr}</> : null}</div>
          </div>
        </div>
      </GradientCard>
    </div>
  );
}
