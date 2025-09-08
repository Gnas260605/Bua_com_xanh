import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { Search, Tag, MapPin, Target, Timer, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/* ======= Small pieces ======= */
function Stat({ label, value }) {
  return (
    <Card className="p-4">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </Card>
  );
}

function FoodCard({ item }) {
  const cover =
    item.images?.[0] ||
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop";

  // các field do API recommendation trả về thêm (mềm dẻo, không bắt buộc)
  const km = typeof item.distance_km === "number" ? item.distance_km : null;
  const score = typeof item.reco_score === "number" ? Math.round(item.reco_score) : null;
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
            <Badge intent="primary"><Target size={12} className="-ml-0.5 mr-1" /> score {score}</Badge>
          ) : null}
        </div>

        <div className="text-xs text-slate-500">
          {item.location_addr ? <>Địa điểm: {item.location_addr}</> : null}
        </div>
      </div>
    </Card>
  );
}

/* ======= Main Page ======= */
export default function Overview() {
  const { user } = useAuth();

  // --- Overview stats
  const [stats, setStats] = useState(null);

  // --- Catalog (search/browse)
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [foods, setFoods] = useState({ items: [], total: 0, page: 1, pageSize: 9 });
  const [loadingFoods, setLoadingFoods] = useState(true);

  // --- Recommendation
  const [latlng, setLatlng] = useState({ lat: null, lng: null });
  const [maxKm, setMaxKm] = useState(5);
  const [dietPref, setDietPref] = useState("any"); // any | chay | kythit | halal | none
  const [personalize, setPersonalize] = useState(true); // học từ lịch sử
  const [recoSort, setRecoSort] = useState("priority"); // priority | expireSoon | dietMatch
  const [reco, setReco] = useState({ items: [], ok: true, msg: "" });
  const [loadingReco, setLoadingReco] = useState(false);

  // --- Admin config (weights)
  const isAdmin = user?.role === "admin";
  const [weights, setWeights] = useState({ distance: 0.4, expiry: 0.3, diet: 0.2, popularity: 0.1 });
  const [metrics, setMetrics] = useState(null);
  const [adminErr, setAdminErr] = useState("");

  // --- debounce search
  const [qDebounced, setQDebounced] = useState("");
  const tRef = useRef(null);
  useEffect(() => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(tRef.current);
  }, [q]);

  /* ===== Load overview stats ===== */
  useEffect(() => {
    apiGet("/api/overview").then(setStats).catch(() => {});
  }, []);

  /* ===== Load browse foods ===== */
  useEffect(() => {
    setLoadingFoods(true);
    const qs = new URLSearchParams({
      q: qDebounced,
      tag,
      page,
      pageSize: 9,
    }).toString();
    apiGet(`/api/foods?${qs}`)
      .then((res) => setFoods(res))
      .finally(() => setLoadingFoods(false));
  }, [qDebounced, tag, page]);

  /* ===== Admin: load weights + metrics (nếu có API) ===== */
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const conf = await apiGet("/api/reco/config");
        if (conf?.weights) setWeights((w) => ({ ...w, ...conf.weights }));
      } catch {
        // bỏ qua, có thể chưa làm API
      }
      try {
        const m = await apiGet("/api/reco/metrics");
        setMetrics(m);
      } catch {
        // chưa có metrics cũng không sao
      }
    })();
  }, [isAdmin]);

  /* ===== Recommendation fetcher ===== */
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

      // Kỳ vọng backend: GET /api/reco/foods?lat&lng&maxKm&diet&personalize&sort&limit
      const data = await apiGet(`/api/reco/foods?${qs}`);
      setReco({ items: Array.isArray(data) ? data : [], ok: true, msg: "" });
    } catch (e) {
      setReco({ items: [], ok: false, msg: "API /api/reco/foods chưa sẵn sàng — đang bỏ qua phần Gợi ý." });
    } finally {
      setLoadingReco(false);
    }
  }

  /* ===== Pickup suggestions (time & waypoint) ===== */
  const [pickup, setPickup] = useState({ ok: true, windows: [], hubs: [] });
  async function fetchPickup() {
    try {
      if (!latlng.lat || !latlng.lng) {
        setPickup({ ok: false, windows: [], hubs: [], msg: "Chưa có vị trí để gợi ý khung giờ/điểm hẹn." });
        return;
      }
      // Kỳ vọng backend: GET /api/reco/pickup?lat&lng
      const data = await apiGet(`/api/reco/pickup?lat=${latlng.lat}&lng=${latlng.lng}`);
      setPickup({
        ok: true,
        windows: data?.windows || [],
        hubs: data?.hubs || [],
      });
    } catch {
      setPickup({ ok: false, windows: [], hubs: [], msg: "API /api/reco/pickup chưa sẵn sàng." });
    }
  }

  /* ===== Helpers ===== */
  const totalPages = Math.max(1, Math.ceil((foods.total || 0) / (foods.pageSize || 9)));

  function getLocation() {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => alert("Không lấy được vị trí. Hãy cấp quyền định vị cho trình duyệt.")
    );
  }

  /* ===== Render ===== */
  return (
    <>
      {/* Banner */}
      <Card className="p-5 mb-5 bg-gradient-to-br from-emerald-50 to-sky-50">
        <div className="text-lg font-semibold">Kết nối bữa ăn dư thừa tới người cần • An toàn • Minh bạch</div>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Người dùng" value={stats ? stats.users || 0 : "…"} />
        <Stat label="Nhà hảo tâm" value={stats ? stats.donors || 0 : "…"} />
        <Stat label="Người nhận" value={stats ? stats.recipients || 0 : "…"} />
        <Stat label="Chiến dịch" value={stats ? stats.campaigns || 0 : "…"} />
      </div>

      {/* === Recommendation Toolbar === */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-semibold mr-2">Gợi ý (Recommendation)</div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={getLocation}>
              <MapPin size={16} className="mr-2" />
              Lấy vị trí
            </Button>
            <div className="text-sm text-slate-600">
              {latlng.lat ? (
                <>({latlng.lat.toFixed(4)}, {latlng.lng?.toFixed(4)})</>
              ) : (
                <>Chưa có vị trí</>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Bán kính</label>
            <input
              type="range"
              min={1}
              max={20}
              value={maxKm}
              onChange={(e) => setMaxKm(Number(e.target.value))}
            />
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
              <input
                type="radio"
                name="recoSort"
                checked={recoSort === o.v}
                onChange={() => setRecoSort(o.v)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </Card>

      {/* === Recommendation Result === */}
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

      {/* === Pickup windows & hubs === */}
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

      {/* === Admin weights & effectiveness === */}
      {isAdmin && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={16} />
            <div className="font-semibold">Admin: Cấu hình trọng số & theo dõi hiệu quả</div>
          </div>

          {adminErr ? (
            <div className="text-sm text-red-600 mb-3">{adminErr}</div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-sm text-slate-600 mb-3">Trọng số tính điểm</div>
              {[
                ["distance", "Khoảng cách"],
                ["expiry", "Gần hết hạn"],
                ["diet", "Phù hợp chế độ ăn"],
                ["popularity", "Mức độ phổ biến"],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center gap-3 mb-3">
                  <div className="w-40 text-sm">{label}</div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((weights[k] || 0) * 100)}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [k]: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))
                    }
                  />
                  <div className="w-10 text-right text-sm">{Math.round((weights[k] || 0) * 100)}%</div>
                </div>
              ))}
              <div className="text-xs text-slate-500">
                Tổng không cần đúng 100% — backend sẽ chuẩn hoá (normalize) khi tính điểm.
              </div>
              <div className="mt-3">
                <Button
                  onClick={async () => {
                    try {
                      // PATCH /api/reco/config  { weights: { distance, expiry, diet, popularity } }
                      await fetch("/api/reco/config", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ weights }),
                        credentials: "include",
                      });
                      setAdminErr("");
                      alert("Đã lưu cấu hình.");
                    } catch {
                      setAdminErr("Không lưu được cấu hình (API /api/reco/config?).");
                    }
                  }}
                >
                  Lưu cấu hình
                </Button>
              </div>
            </Card>

            <Card className="p-3">
              <div className="text-sm text-slate-600 mb-3">Theo dõi hiệu quả</div>
              {metrics ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">CTR gợi ý</div>
                    <div className="text-xl font-bold">{(metrics.ctr || 0).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Tỉ lệ nhận thành công</div>
                    <div className="text-xl font-bold">{(metrics.success_rate || 0).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Giảm lãng phí (ước tính)</div>
                    <div className="text-xl font-bold">{(metrics.waste_reduction || 0).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Thời gian giao (tb)</div>
                    <div className="text-xl font-bold">{metrics.avg_delivery_mins || 0} phút</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Chưa có dữ liệu.</div>
              )}
            </Card>
          </div>
        </Card>
      )}

      {/* === Browse toolbar (giữ tối giản) === */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white w-72 outline-none
                       focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Tìm bữa cơm…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <div className="relative">
          <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white w-52 outline-none
                       focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Lọc tag…"
            value={tag}
            onChange={(e) => {
              setPage(1);
              setTag(e.target.value);
            }}
          />
        </div>
      </div>

      {/* === Browse grid === */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Bữa cơm đang có</div>
        <div className="text-sm text-slate-500">{foods.total} mục</div>
      </div>

      {loadingFoods ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : foods.items.length === 0 ? (
        <Empty title="Chưa có bữa cơm" hint="Hãy thử đổi bộ lọc hoặc thêm dữ liệu seed." />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foods.items.map((it) => (
              <FoodCard key={it.id} item={it} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button variant="ghost" className="px-3" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              « Trước
            </Button>
            <div className="text-sm px-2">
              Trang {page}/{Math.max(1, totalPages)}
            </div>
            <Button
              variant="ghost"
              className="px-3"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau »
            </Button>
          </div>
        </>
      )}
    </>
  );
}
