import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import {
  Users, Soup, HandHeart, Megaphone, ArrowRight, MapPin, Calendar, Target, Timer, AlertTriangle
} from "lucide-react";

/* =========================
   Small bits
========================= */
function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl border bg-white shadow-sm">
      <div className="p-2 rounded-lg bg-emerald-50">
        <Icon size={18} className="text-emerald-600" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function FeaturedCard({ c }) {
  const cover =
    c.cover && c.cover.length > 4
      ? c.cover
      : "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1200&auto=format&fit=crop";
  const pct = Math.min(100, Math.round((c.raised / (c.goal || 1)) * 100));

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition">
      <div className="relative">
        <img src={cover} alt="" className="h-40 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition" />
        {c.location ? (
          <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <MapPin size={12} /> {c.location}
          </span>
        ) : null}
      </div>

      <div className="p-4 space-y-3">
        <div className="font-semibold line-clamp-1">{c.title || "Chiến dịch"}</div>
        <div className="text-sm text-slate-600 line-clamp-2">{c.description || "—"}</div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-slate-600 flex items-center justify-between">
          <span>
            Gây quỹ: <b>{(c.raised ?? 0).toLocaleString("vi-VN")}đ</b> / {(c.goal ?? 0).toLocaleString("vi-VN")}đ
          </span>
          {c.deadline ? (
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {new Date(c.deadline).toLocaleDateString("vi-VN")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(c.tags || []).slice(0, 3).map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          {typeof c.impact_meals === "number" ? (
            <Badge intent="primary" className="ml-auto">
              <Soup size={12} className="-ml-0.5 mr-1" />
              {c.impact_meals.toLocaleString("vi-VN")} bữa
            </Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* =========================
   Count-up hook (mượt)
========================= */
function useCountUp(target = 0, durationMs = 1200) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = 0;
    fromRef.current = val;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
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

/* =========================
   Overview for USER (with Recommendation)
========================= */
export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [featured, setFeatured] = useState({ items: [], total: 0 });
  const [loadingFeat, setLoadingFeat] = useState(true);

  // === Recommendation state (04/05/06) ===
  const [latlng, setLatlng] = useState({ lat: null, lng: null });
  const [maxKm, setMaxKm] = useState(5);
  const [dietPref, setDietPref] = useState("any"); // any | chay | halal | kythit | none
  const [personalize, setPersonalize] = useState(true);
  const [recoSort, setRecoSort] = useState("priority"); // priority | expireSoon | dietMatch
  const [reco, setReco] = useState({ items: [], ok: true, msg: "" });
  const [loadingReco, setLoadingReco] = useState(false);

  // === Pickup (09) ===
  const [pickup, setPickup] = useState({ ok: true, windows: [], hubs: [], msg: "" });

  // Load overview stats (User-facing)
  useEffect(() => {
    (async () => {
      setLoadingStats(true);
      try {
        const s = await apiGet("/api/overview");
        setStats(s || {});
      } catch {
        setStats({});
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  // Load featured campaigns
  useEffect(() => {
    (async () => {
      setLoadingFeat(true);
      try {
        let res = await apiGet("/api/campaigns?featured=1&pageSize=6");
        if (!res?.items?.length) {
          res = await apiGet("/api/campaigns?page=1&pageSize=6");
        }
        setFeatured(res || { items: [], total: 0 });
      } catch {
        setFeatured({ items: [], total: 0 });
      } finally {
        setLoadingFeat(false);
      }
    })();
  }, []);

  // Chuẩn hóa tên trường
  const mealsGiven = useMemo(() => {
    const m = stats?.meals_given ?? stats?.meals ?? stats?.distributed_meals ?? 0;
    return Number.isFinite(m) ? m : 0;
  }, [stats]);

  const donors = stats?.donors ?? 0;
  const recipients = stats?.recipients ?? 0;
  const campaigns = stats?.campaigns ?? stats?.active_campaigns ?? 0;

  const heroCount = useCountUp(mealsGiven, 1200);

  // === Recommendation handlers ===
  function getLocation() {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert("Không lấy được vị trí. Hãy cấp quyền định vị cho trình duyệt.")
    );
  }

  async function fetchRecommendations() {
    setLoadingReco(true);
    try {
      const qs = new URLSearchParams({
        lat: latlng.lat ?? "",
        lng: latlng.lng ?? "",
        maxKm: String(maxKm || ""),
        diet: dietPref,
        personalize: String(personalize),
        sort: recoSort,
        limit: "9",
      }).toString();
      const data = await apiGet(`/api/reco/foods?${qs}`);
      setReco({ items: Array.isArray(data) ? data : [], ok: true, msg: "" });
    } catch (e) {
      setReco({ items: [], ok: false, msg: "Không lấy được gợi ý (API /api/reco/foods)." });
    } finally {
      setLoadingReco(false);
    }
  }

  async function fetchPickup() {
    try {
      if (!latlng.lat || !latlng.lng) {
        setPickup({ ok: false, windows: [], hubs: [], msg: "Chưa có vị trí để gợi ý khung giờ/điểm hẹn." });
        return;
      }
      const data = await apiGet(`/api/reco/pickup?lat=${latlng.lat}&lng=${latlng.lng}`);
      setPickup({ ok: true, windows: data?.windows || [], hubs: data?.hubs || [], msg: "" });
    } catch {
      setPickup({ ok: false, windows: [], hubs: [], msg: "Không lấy được gợi ý điểm hẹn." });
    }
  }

  return (
    <>
      {/* ===== HERO: Big number ===== */}
      <section className="mb-8">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_-10%_-10%,#34d39920,transparent),radial-gradient(800px_400px_at_110%_10%,#38bdf820,transparent)]" />
          <div className="relative p-6 md:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-6">
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-2">
                <HandHeart size={16} /> Cùng nhau giảm lãng phí – lan tỏa yêu thương
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Đã kết nối <span className="text-emerald-600">bữa ăn</span> tới cộng đồng
              </h1>
              <div className="mt-4 mb-2 text-6xl md:text-7xl font-black leading-none">
                {loadingStats ? "…" : heroCount.toLocaleString("vi-VN")}
              </div>
              <div className="text-slate-600">bữa ăn đã được cho đi</div>
              <div className="mt-6 flex items-center gap-3">
                <Button onClick={() => (window.location.href = "/campaigns")}>
                  Tham gia ủng hộ <ArrowRight size={16} className="ml-1" />
                </Button>
                <Button variant="outline" onClick={() => (window.location.href = "/reports")}>
                  Xem tác động
                </Button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3 w-full lg:w-96">
              <StatChip icon={Users} label="Nhà hảo tâm" value={donors.toLocaleString("vi-VN")} />
              <StatChip icon={HandHeart} label="Người nhận" value={recipients.toLocaleString("vi-VN")} />
              <StatChip icon={Megaphone} label="Chiến dịch đang chạy" value={campaigns.toLocaleString("vi-VN")} />
              <StatChip icon={Soup} label="Tổng bữa tặng" value={mealsGiven.toLocaleString("vi-VN")} />
            </div>
          </div>
        </Card>
      </section>

      {/* ===== Recommendation Toolbar (04/05/06) ===== */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-semibold mr-2">Gợi ý cho bạn</div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={getLocation}>
              <MapPin size={16} className="mr-2" />
              Lấy vị trí
            </Button>
            <div className="text-sm text-slate-600">
              {latlng.lat ? <>({latlng.lat.toFixed(4)}, {latlng.lng?.toFixed(4)})</> : <>Chưa có vị trí</>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Bán kính</label>
            <input type="range" min={1} max={20} value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} />
            <div className="w-10 text-right text-sm">{maxKm}km</div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Chế độ ăn</label>
            <select className="input" value={dietPref} onChange={(e) => setDietPref(e.target.value)}>
              <option value="any">Bất kỳ</option>
              <option value="chay">Ăn chay</option>
              <option value="halal">Halal</option>
              <option value="kythit">Kỵ thịt</option>
              <option value="none">Không ưu tiên</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={personalize} onChange={() => setPersonalize(!personalize)} />
            Cá nhân hoá từ lịch sử
          </label>

          <Button onClick={fetchRecommendations} className="ml-2">
            Lấy gợi ý
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <div className="text-sm text-slate-600">Xếp hạng ưu tiên:</div>
          {[
            { v: "priority", label: "Tổng hợp (trọng số)" },
            { v: "expireSoon", label: "Gần hết hạn" },
            { v: "dietMatch", label: "Phù hợp chế độ ăn" },
          ].map((o) => (
            <label key={o.v} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="radio" name="recoSort" checked={recoSort === o.v} onChange={() => setRecoSort(o.v)} />
              {o.label}
            </label>
          ))}
        </div>
      </Card>

      {/* ===== Recommendation Result ===== */}
      {loadingReco ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : !reco.ok ? (
        <Card className="p-3 mb-6 flex items-center gap-2 text-amber-700 bg-amber-50 border-amber-200">
          <AlertTriangle size={18} /> <span>{reco.msg}</span>
        </Card>
      ) : reco.items.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Gợi ý cho bạn</div>
            <div className="text-sm text-slate-500">{reco.items.length} mục</div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {reco.items.map((it) => (
              <FoodCard key={it.id} item={it} />
            ))}
          </div>
        </>
      ) : null}

      {/* ===== Pickup windows & hubs (09) ===== */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Timer size={16} />
          <div className="font-semibold">Gợi ý khung giờ & điểm hẹn tối ưu</div>
          <Button variant="outline" className="ml-auto" onClick={fetchPickup}>
            Gợi ý ngay
          </Button>
        </div>

        {!pickup.ok && pickup.msg ? (
          <div className="text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle size={16} /> {pickup.msg}
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-sm text-slate-600 mb-2">Khung giờ gợi ý</div>
              {pickup.windows?.length ? (
                <div className="flex flex-wrap gap-2">
                  {pickup.windows.map((w, i) => (
                    <Badge key={i} intent="primary">{w}</Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">Chưa có dữ liệu.</div>
              )}
            </Card>

            <Card className="p-3">
              <div className="text-sm text-slate-600 mb-2">Điểm hẹn/Hubs gần</div>
              {pickup.hubs?.length ? (
                <ul className="text-sm list-disc ml-5 space-y-1">
                  {pickup.hubs.map((h) => (
                    <li key={h.id}>
                      <span className="font-medium">{h.name}</span>{" "}
                      {typeof h.distance_km === "number" ? (
                        <span className="text-slate-500">({h.distance_km.toFixed(1)} km)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">Chưa có dữ liệu.</div>
              )}
            </Card>
          </div>
        )}
      </Card>

      {/* ===== Sứ mệnh (ngắn gọn) ===== */}
      <section className="mb-6">
        <Card className="p-5 bg-gradient-to-br from-emerald-50 to-sky-50 border-emerald-100">
          <div className="flex items-start gap-3">
            <Target size={18} className="mt-0.5 text-emerald-700" />
            <div>
              <div className="font-semibold">Sứ mệnh</div>
              <p className="text-slate-600 text-sm mt-1">
                Bữa Cơm Xanh kết nối thức ăn còn tốt từ nhà hảo tâm đến người cần, đảm bảo an toàn – minh bạch – kịp thời.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* ===== Chiến dịch tiêu biểu (User only) ===== */}
      <section className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chiến dịch tiêu biểu</h2>
        <Button variant="ghost" onClick={() => (window.location.href = "/campaigns")}>
          Xem tất cả <ArrowRight size={14} className="ml-1" />
        </Button>
      </section>

      {loadingFeat ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : featured.items.length === 0 ? (
        <Empty title="Chưa có chiến dịch" hint="Hãy quay lại sau hoặc khám phá các mục khác." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.items.map((c) => (
            <FeaturedCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

/* ============== Small piece for Reco cards ============== */
function FoodCard({ item }) {
  const cover =
    item.images?.[0] ||
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop";

  const km = typeof item.distance_km === "number" ? item.distance_km : null;
  const score = typeof item.reco_score === "number" ? Math.round(item.reco_score * 100) : null;
  const hoursLeft =
    item.expire_at ? Math.max(0, Math.ceil((new Date(item.expire_at) - new Date()) / (1000 * 60 * 60))) : null;
  const dietMatch = item.diet_match === true;

  return (
    <Card className="overflow-hidden">
      <img src={cover} alt="" className="h-40 w-full object-cover" />
      <div className="p-4 space-y-2">
        <div className="font-semibold line-clamp-1">{item.title}</div>
        <div className="text-sm text-slate-600 line-clamp-2">{item.description}</div>
        <div className="text-sm">
          Còn <b>{item.qty}</b> {item.unit}
          {item.expire_at ? <> • HSD {new Date(item.expire_at).toLocaleString("vi-VN")}</> : null}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {(item.tags || []).slice(0, 4).map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          {dietMatch ? <Badge intent="success">Phù hợp chế độ ăn</Badge> : null}
          {km !== null ? (
            <Badge><MapPin size={12} className="-ml-0.5 mr-1" /> {km.toFixed(1)} km</Badge>
          ) : null}
          {hoursLeft !== null ? (
            <Badge intent={hoursLeft <= 12 ? "warning" : "default"}>
              <Timer size={12} className="-ml-0.5 mr-1" /> còn ~{hoursLeft}h
            </Badge>
          ) : null}
          {score !== null ? (
            <Badge intent="primary">score {score}</Badge>
          ) : null}
        </div>

        <div className="text-xs text-slate-500">
          {item.location_addr ? <>Địa điểm: {item.location_addr}</> : null}
        </div>
      </div>
    </Card>
  );
}
