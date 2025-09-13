// src/pages/CampaignDetail.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../lib/api";

/* ============== Helpers ============== */
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const parseJson = (raw, fb = {}) => {
  try {
    if (!raw) return fb;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fb;
  }
};
const fmtMoney = (n) => toNum(n, 0).toLocaleString("vi-VN") + " đ";
const isMealCampaign = (c = {}) => {
  const t = (c.type || c.kind || c.category || "").toString().toLowerCase();
  return t === "meal" || t.includes("meal") || t.includes("bữa");
};

function normalizeCampaign(r) {
  const meta = parseJson(r.meta ?? r.tags, {});
  const type = r.type || meta?.type || "money";
  const cover_url = r.cover_url || r.cover || "";
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

    // meal
    type,
    meal_unit: meal?.unit || "phần",
    meal_target_qty: toNum(meal?.target_qty, 0),
    meal_received_qty: toNum(meal?.received_qty, 0),

    // extras
    meta,
    payment,
    payment_method: payment?.method || "momo",
    cover_url,
    images: Array.isArray(r.images) ? r.images : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    owner: r.owner || r.created_by || null,
  };
}

/** Ưu tiên /api/campaigns/:id; fallback /api/campaigns?ids= */
async function fetchCampaignById(id) {
  try {
    const r = await apiGet(`/api/campaigns/${id}`);
    if (r) return normalizeCampaign(r.item ?? r.data ?? r.value ?? r);
  } catch {}
  try {
    const r2 = await apiGet(`/api/campaigns?ids=${encodeURIComponent(id)}`);
    const arr = r2?.items ?? r2?.data ?? r2?.value ?? r2;
    if (Array.isArray(arr) && arr.length) return normalizeCampaign(arr[0]);
  } catch {}
  return null;
}

/** Dùng donations làm nguồn chính */
async function fetchSupporters(id) {
  try {
    const r = await apiGet(`/api/campaigns/${id}/donations?page=1&pageSize=200`);
    return r?.items ?? r?.data ?? r?.value ?? r ?? [];
  } catch {}
  try {
    const r2 = await apiGet(`/api/donations?campaign_id=${encodeURIComponent(id)}&page=1&pageSize=200`);
    return r2?.items ?? r2?.data ?? r2?.value ?? r2 ?? [];
  } catch {}
  return [];
}

function normalizeSupporter(x) {
  return {
    id: x.id ?? x.donation_id ?? Math.random().toString(36).slice(2),
    name: (x.name ?? x.full_name ?? x.display_name ?? x.user_name ?? x.donor_name ?? "Ẩn danh").toString(),
    amount: toNum(x.amount ?? x.value ?? x.money ?? x.total, 0),
    at: x.created_at ?? x.paid_at ?? x.time ?? x.date ?? x.updated_at ?? null,
    message: x.message ?? x.note ?? x.memo ?? "",
    anonymous: Boolean(x.anonymous ?? x.is_anonymous),
    avatar: x.avatar_url ?? x.avatar ?? "",
    method: x.method ?? x.gateway ?? "",
  };
}

function Bar({ value = 0 }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Avatar({ name = "?", src }) {
  if (src) return <img src={src} alt={name} className="h-10 w-10 rounded-full object-cover border" />;
  const initials = name.split(" ").map(s => s[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
  return (
    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white grid place-items-center text-xs font-bold">
      {initials || "?"}
    </div>
  );
}

/* ============== PAGE ============== */
export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [supporters, setSupporters] = useState([]);
  const [loadingSup, setLoadingSup] = useState(true);

  // filter supporters
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [onlyNamed, setOnlyNamed] = useState(false);

  // fetch campaign
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const c = await fetchCampaignById(id);
        if (!mounted) return;
        if (!c) {
          setErr("Không tìm thấy chiến dịch.");
        } else {
          setCampaign(c);
        }
      } catch (e) {
        if (mounted) setErr(e?.message || "Lỗi tải dữ liệu chiến dịch.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  // fetch supporters
  useEffect(() => {
    if (!campaign?.id) return;
    let mounted = true;
    (async () => {
      try {
        setLoadingSup(true);
        const raw = await fetchSupporters(campaign.id);
        const arr = Array.isArray(raw) ? raw : [];
        if (!mounted) return;
        setSupporters(arr.map(normalizeSupporter));
      } finally {
        if (mounted) setLoadingSup(false);
      }
    })();
    return () => { mounted = false; };
  }, [campaign?.id]);

  const pct = useMemo(() => {
    const p = (toNum(campaign?.raised_amount, 0) / Math.max(1, toNum(campaign?.target_amount, 0))) * 100;
    return Math.min(100, Math.max(0, Math.round(p)));
  }, [campaign]);

  const supportersView = useMemo(() => {
    let arr = supporters.slice();
    if (onlyNamed) arr = arr.filter(x => !x.anonymous);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(x =>
        (x.name || "").toLowerCase().includes(s) ||
        (x.message || "").toLowerCase().includes(s)
      );
    }
    if (sort === "newest") arr.sort((a,b) => new Date(b.at || 0) - new Date(a.at || 0));
    else if (sort === "amount") arr.sort((a,b) => (b.amount||0) - (a.amount||0));
    return arr;
  }, [supporters, q, sort, onlyNamed]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-10 w-64 bg-slate-100 rounded mb-4" />
        <div className="h-64 bg-slate-100 rounded-3xl mb-6" />
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_,i)=>(<div key={i} className="h-28 bg-slate-100 rounded-2xl" />))}
        </div>
      </div>
    );
  }
  if (err) return <div className="p-6 text-rose-600 text-lg font-semibold">{err}</div>;
  if (!campaign) return <div className="p-6 text-slate-700">Không có dữ liệu.</div>;

  const cover = campaign.cover_url || campaign.images?.[0] || "/images/campaign-placeholder.jpg";
  const meal = isMealCampaign(campaign);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      {/* Breadcrumb */}
      <nav className="text-sm">
        <Link to="/" className="text-slate-600 hover:text-slate-800">Trang chủ</Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link to="/campaigns" className="text-slate-600 hover:text-slate-800">Chiến dịch</Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-900 font-semibold line-clamp-1">{campaign.title}</span>
      </nav>

      {/* Header block */}
      <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          <img src={cover} alt="" className="h-72 md:h-80 lg:h-96 w-full object-cover" />
          {meal && (
            <span className="absolute top-4 left-4 px-2.5 py-1 text-xs rounded-full bg-emerald-600 text-white shadow">
              Bữa ăn
            </span>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              {campaign.title}
            </h1>

            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1",
                  campaign.status === "active"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-slate-50 text-slate-800 ring-slate-200",
                ].join(" ")}
              >
                {campaign.status || "unknown"}
              </span>
              {campaign.deadline && (
                <span className="text-sm text-slate-600">
                  Hạn: <b className="text-slate-900">{new Date(campaign.deadline).toLocaleDateString("vi-VN")}</b>
                </span>
              )}
            </div>
          </div>

          {/* 2 cột: trái nội dung, phải tóm tắt/tiến độ */}
          <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
            {/* Left: description & extras */}
            <div className="space-y-5">
              <p className="text-[17px] leading-8 text-slate-800 whitespace-pre-line">
                {campaign.description || "—"}
              </p>

              {meal && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-900">
                  <div className="text-[15px]">
                    Khẩu phần đã nhận:{" "}
                    <b>
                      {toNum(campaign.meal_received_qty, 0).toLocaleString("vi-VN")}{" "}
                      {campaign.meal_unit}
                    </b>
                    {campaign.meal_target_qty ? (
                      <> / {toNum(campaign.meal_target_qty, 0).toLocaleString("vi-VN")} {campaign.meal_unit}</>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/reports?campaign_id=${encodeURIComponent(campaign.id)}`}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-900 hover:bg-slate-50 transition"
                >
                  Xem sao kê
                </Link>
                <Link
                  to={`/delivery?campaign_id=${encodeURIComponent(campaign.id)}`}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-900 hover:bg-slate-50 transition"
                >
                  Lịch giao/nhận
                </Link>
              </div>
            </div>

            {/* Right: summary card */}
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="text-sm text-slate-600">Đã gây quỹ</div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900">{fmtMoney(campaign.raised_amount)}</div>
              {campaign.target_amount ? (
                <div className="text-sm text-slate-700">/ {fmtMoney(campaign.target_amount)}</div>
              ) : null}
              <div className="mt-3"><Bar value={pct} /></div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-[15px]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm text-slate-600">Người ủng hộ</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {toNum(campaign.supporters,0).toLocaleString("vi-VN")}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm text-slate-600">Địa điểm</div>
                  <div className="text-[15px] text-slate-900">{campaign.location || "—"}</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Cập nhật: {campaign.updated_at ? new Date(campaign.updated_at).toLocaleString("vi-VN") : "—"}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Supporters */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Danh sách ủng hộ</h2>
            <p className="text-xs text-slate-500">Nguồn dữ liệu: /api/campaigns/{campaign.id}/donations</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              className="input h-10 w-60"
              placeholder="Tìm theo tên/ghi chú…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="input h-10 w-56" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="amount">Số tiền (cao → thấp)</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900">
              <input type="checkbox" checked={onlyNamed} onChange={()=>setOnlyNamed(v=>!v)} />
              Chỉ hiện người có tên
            </label>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loadingSup ? (
            <div className="flex items-center gap-3 text-slate-700">
              <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
              Đang tải danh sách ủng hộ…
            </div>
          ) : supportersView.length === 0 ? (
            <div className="text-slate-700 text-sm">Chưa có dữ liệu ủng hộ.</div>
          ) : (
            <ul className="divide-y rounded-2xl border border-slate-200 overflow-hidden bg-white">
              {supportersView.map(x => (
                <li key={x.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="grid grid-cols-[auto,1fr,auto] items-start gap-4">
                    <Avatar name={x.anonymous ? "Ẩn danh" : x.name} src={x.avatar} />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="font-semibold text-slate-900 truncate">{x.anonymous ? "Ẩn danh" : x.name}</div>
                        <div className="text-xs text-slate-500">{x.at ? new Date(x.at).toLocaleString("vi-VN") : ""}</div>
                        {x.method ? <span className="text-xs text-slate-500">• {x.method}</span> : null}
                      </div>
                      {x.message ? <div className="text-[15px] text-slate-800 mt-0.5 break-words">{x.message}</div> : null}
                    </div>

                    <div className="text-right">
                      <div className="text-emerald-700 font-bold text-lg tabular-nums">
                        {toNum(x.amount,0).toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Meta / Payment */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Thông tin thêm</h3>
          <div className="text-[15px] text-slate-800 space-y-1.5">
            <div><span className="text-slate-600">Tạo lúc:</span> {campaign.created_at ? new Date(campaign.created_at).toLocaleString("vi-VN") : "—"}</div>
            <div><span className="text-slate-600">Cập nhật:</span> {campaign.updated_at ? new Date(campaign.updated_at).toLocaleString("vi-VN") : "—"}</div>
            <div><span className="text-slate-600">Địa điểm:</span> {campaign.location || "—"}</div>
            {campaign.tags?.length ? <div><span className="text-slate-600">Tags:</span> {campaign.tags.join(", ")}</div> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Thanh toán/Chuyển khoản</h3>
          <div className="text-[15px] text-slate-800">
            {campaign.payment?.bank && campaign.payment?.account ? (
              <div className="space-y-1.5">
                <div><span className="text-slate-600">Ngân hàng:</span> {campaign.payment.bank}</div>
                <div><span className="text-slate-600">Số TK:</span> {campaign.payment.account}</div>
                {campaign.payment.name ? <div><span className="text-slate-600">Chủ TK:</span> {campaign.payment.name}</div> : null}
                {campaign.payment.memo ? <div><span className="text-slate-600">Nội dung:</span> {campaign.payment.memo}</div> : null}
              </div>
            ) : (
              <div className="text-slate-700">Chiến dịch không công bố thông tin chuyển khoản riêng.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
