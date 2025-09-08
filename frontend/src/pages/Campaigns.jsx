import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../lib/api";

/** Thẻ nhỏ hiển thị thống kê */
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
  const raised = Number(c.raised || 0);
  const goal = Number(c.goal || 0);
  const pct = Math.min(100, Math.round((raised / (goal || 1)) * 100));

  // ngày còn lại (nếu có deadline)
  const daysLeft =
    c.deadline ? Math.max(0, Math.ceil((new Date(c.deadline) - new Date()) / (1000 * 60 * 60 * 24))) : null;

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
          Đã gây quỹ <b>{raised.toLocaleString("vi-VN")} đ</b>
          {goal ? <> / {goal.toLocaleString("vi-VN")} đ</> : null}
          {typeof c.supporters === "number" ? (
            <span className="text-slate-500"> • {c.supporters} người ủng hộ</span>
          ) : null}
          {daysLeft !== null ? <span className="text-slate-500"> • Còn {daysLeft} ngày</span> : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(c.tags || []).slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
              #{t}
            </span>
          ))}
          {c.status ? (
            <span
              className={
                "px-2 py-0.5 text-xs rounded-full " +
                (c.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : c.status === "ended"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-amber-50 text-amber-700")
              }
            >
              {c.status}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const location = useLocation(); // refetch khi quay lại route
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | progress | supporters | endingSoon
  const [filters, setFilters] = useState({
    diet: false, // "chay"
    expiring: false, // ưu tiên sắp hết hạn
    activeOnly: true, // chỉ đang hoạt động
  });

  // --- Debounce tìm kiếm ---
  const [qDebounced, setQDebounced] = useState("");
  const typingTimer = useRef(null);
  useEffect(() => {
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(typingTimer.current);
  }, [q]);

  // --- Tải dữ liệu ---
  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();

    (async () => {
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
    })();

    // scroll lên đầu khi vào trang
    window.scrollTo({ top: 0, behavior: "instant" });

    return () => {
      isMounted = false;
      ac.abort();
    };
  }, [location.key]);

  // --- Xử lý & hiển thị danh sách ---
  const list = useMemo(() => {
    const pct = (c) => {
      const raised = Number(c.raised || 0);
      const goal = Number(c.goal || 0);
      return Math.min(100, Math.round((raised / (goal || 1)) * 100));
    };

    const daysLeft = (c) =>
      c.deadline ? Math.ceil((new Date(c.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : Infinity;

    let arr = [...raw];

    // search theo tiêu đề + mô tả + tags + địa điểm (nếu có)
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

    // filters
    if (filters.activeOnly) arr = arr.filter((c) => (c.status || "active") === "active");
    if (filters.diet) arr = arr.filter((c) => (c.tags || []).some((t) => String(t).toLowerCase().includes("chay")));
    if (filters.expiring) {
      // ưu tiên pct thấp và gần hết hạn
      arr = arr
        .slice()
        .sort((a, b) => {
          // sắp theo ngày còn lại tăng dần, rồi theo tiến độ tăng dần
          const da = daysLeft(a);
          const db = daysLeft(b);
          if (da !== db) return da - db;
          return pct(a) - pct(b);
        });
    }

    // sort
    if (sortBy === "progress") arr = arr.slice().sort((a, b) => pct(b) - pct(a));
    else if (sortBy === "supporters") arr = arr.slice().sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    else if (sortBy === "endingSoon")
      arr = arr.slice().sort((a, b) => {
        const da = daysLeft(a);
        const db = daysLeft(b);
        return da - db;
      });
    else if (sortBy === "newest")
      arr = arr
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // fallback giữ nguyên nếu thiếu

    return arr;
  }, [raw, qDebounced, filters, sortBy]);

  return (
    <div className="space-y-6">
      {/* Thanh công cụ: chỉ những thứ cần thiết */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="text-xl font-semibold flex-1">Chiến dịch đang chạy</div>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              className="input w-64"
              placeholder="Tìm theo tiêu đề, mô tả, tag, địa điểm…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="progress">Tiến độ</option>
              <option value="supporters">Nhiều ủng hộ</option>
              <option value="endingSoon">Sắp kết thúc</option>
            </select>

            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input
                type="checkbox"
                checked={filters.activeOnly}
                onChange={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))}
              />
              Đang hoạt động
            </label>

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
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Người ủng hộ" value={raw.reduce((a, c) => a + (c.supporters || 0), 0).toLocaleString("vi-VN")} />
        <Stat label="Đã gây quỹ" value={ (raw.reduce((a, c) => a + (Number(c.raised) || 0), 0)).toLocaleString("vi-VN") + " đ"} />
        <Stat label="Khẩu phần" value={(raw.reduce((a, c) => a + (Number(c.meals) || 0), 0) || 0).toLocaleString("vi-VN")} />
        <Stat label="Chiến dịch" value={raw.length} />
      </div>

      {/* Body */}
      {err ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-red-600">{err}</div>
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
