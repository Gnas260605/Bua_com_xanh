import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../lib/api";

/** Thẻ nhỏ đẹp đẹp */
function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-slate-500 text-sm">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border bg-white shadow-sm animate-pulse">
      <div className="h-44 w-full bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-slate-100 rounded w-3/4" />
        <div className="h-4 bg-slate-100 rounded w-5/6" />
        <div className="h-2 bg-slate-100 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-5 bg-slate-100 rounded-full w-16" />
          <div className="h-5 bg-slate-100 rounded-full w-14" />
          <div className="h-5 bg-slate-100 rounded-full w-12" />
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ c }) {
  const cover = c.cover || c.images?.[0] || "/images/campaign-placeholder.jpg";
  const pct = Math.min(100, Math.round((c.raised / (c.goal || 1)) * 100));
  return (
    <div className="rounded-2xl overflow-hidden border bg-white shadow-sm">
      <img src={cover} alt="" className="h-44 w-full object-cover" />
      <div className="p-4 space-y-2">
        <div className="text-lg font-semibold line-clamp-2">{c.title}</div>
        <div className="text-sm text-slate-600 line-clamp-2">{c.description}</div>
        <div className="h-2 rounded bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm text-slate-700">
          Đã gây quỹ <b>{(c.raised || 0).toLocaleString("vi-VN")} đ</b> / {(c.goal || 0).toLocaleString("vi-VN")} đ
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(c.tags || []).slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const location = useLocation(); // đảm bảo refetch khi quay lại route này
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ diet: false, expiring: false });
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();

    async function fetchData() {
      try {
        setErr("");
        setLoading(true);
        const data = await apiGet("/api/campaigns", { signal: ac.signal });
        if (!isMounted) return;
        setRaw(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Không thể tải danh sách chiến dịch.");
          setRaw([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // mỗi lần location.key thay đổi (mỗi lần điều hướng), refetch
    fetchData();

    // scroll lên đầu khi vào trang
    window.scrollTo({ top: 0, behavior: "instant" });

    return () => {
      isMounted = false;
      ac.abort();
    };
    // location.key: đảm bảo chạy lại khi chuyển trang qua route này
  }, [location.key]);

  const list = useMemo(() => {
    const pct = (c) => Math.min(100, Math.round((c.raised / (c.goal || 1)) * 100));
    let arr = [...raw];

    // search
    const s = q.trim().toLowerCase();
    if (s) arr = arr.filter((c) => (c.title || "").toLowerCase().includes(s) || (c.description || "").toLowerCase().includes(s));

    // filters
    if (filters.diet) arr = arr.filter((c) => (c.tags || []).some((t) => `${t}`.toLowerCase().includes("chay")));
    if (filters.expiring) arr = arr.sort((a, b) => pct(a) - pct(b)); // ưu tiên pct thấp

    // sort
    if (sortBy === "progress") arr = arr.sort((a, b) => pct(b) - pct(a));
    else if (sortBy === "supporters") arr = arr.sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    else if (sortBy === "newest") {
      // fallback: nếu không có created_at thì giữ nguyên
      arr = arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return arr;
  }, [raw, q, filters, sortBy]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="text-xl font-semibold flex-1">Chiến dịch đang chạy</div>
          <div className="flex gap-2 flex-wrap">
            <input
              className="input w-64"
              placeholder="Tìm chiến dịch"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="progress">Tiến độ</option>
              <option value="supporters">Nhiều ủng hộ</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input
                type="checkbox"
                checked={filters.diet}
                onChange={() => setFilters((f) => ({ ...f, diet: !f.diet }))}
              />
              Ăn chay
            </label>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input
                type="checkbox"
                checked={filters.expiring}
                onChange={() => setFilters((f) => ({ ...f, expiring: !f.expiring }))}
              />
              Sắp hết hạn
            </label>
            <button className="btn">+ Tạo chiến dịch</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Người ủng hộ"
          value={raw.reduce((a, c) => a + (c.supporters || 0), 0).toLocaleString("vi-VN")}
        />
        <Stat
          label="Đã gây quỹ"
          value={raw.reduce((a, c) => a + (c.raised || 0), 0).toLocaleString("vi-VN") + " đ"}
        />
        <Stat label="Khẩu phần" value={(raw.reduce((a, c) => a + (c.meals || 0), 0) || 0).toLocaleString("vi-VN")} />
        <Stat label="Chiến dịch" value={raw.length} />
      </div>

      {/* Body */}
      {err ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-red-600">
          {err}
        </div>
      ) : loading ? (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-slate-600">
          Chưa có chiến dịch phù hợp.
        </div>
      ) : (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
