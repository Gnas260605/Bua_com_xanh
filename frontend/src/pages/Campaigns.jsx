// frontend/src/pages/Campaigns.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

/* ========== UI bits ========== */
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

/* ========== Donate Modal ========== */
function DonateModal({ open, onClose, campaign, gateways }) {
  const [amount, setAmount] = useState(200000);
  const [method, setMethod] = useState(gateways?.[0]?.code || "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState({ img: "", svg: "" });

  useEffect(() => {
    if (open) {
      setAmount(200000);
      setMethod(gateways?.[0]?.code || "");
      setSubmitting(false);
      setErr("");
      setQr({ img: "", svg: "" });
    }
  }, [open, gateways]);

  async function createDonation() {
    try {
      setErr("");
      setSubmitting(true);
      setQr({ img: "", svg: "" });

      const body = { campaign_id: campaign.id, amount: Number(amount || 0), method };
      const res = await apiPost("/api/payments/create", body);

      if (res?.pay_url) {
        // chuyển sang trang thanh toán (VNPAY/MoMo/ZaloPay/Stripe ...)
        window.location.href = res.pay_url;
        return;
      }
      if (res?.qr_image || res?.qr_svg) {
        setQr({ img: res.qr_image || "", svg: res.qr_svg || "" });
        return;
      }
      setErr("Chưa nhận được liên kết thanh toán/QR. Vui lòng thử lại.");
    } catch (e) {
      setErr(e?.message || "Không tạo được giao dịch. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border bg-white shadow-xl">
        <div className="p-5 border-b">
          <div className="text-lg font-semibold">Ủng hộ chiến dịch</div>
          <div className="text-sm text-slate-600 line-clamp-2">{campaign?.title}</div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-slate-600">Số tiền (đ)</label>
            <input
              type="number"
              min={10000}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 input w-full"
              placeholder="Nhập số tiền muốn ủng hộ"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[50000, 100000, 200000, 500000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={
                    "px-3 py-1 rounded-xl border text-sm " +
                    (amount === v ? "bg-emerald-600 text-white border-emerald-600" : "bg-white")
                  }
                >
                  {v.toLocaleString("vi-VN")} đ
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">Cổng thanh toán</label>
            {gateways?.length ? (
              <select
                className="mt-1 input w-full"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {gateways.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.name || g.code}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
                Chưa cấu hình cổng thanh toán. Liên hệ quản trị viên.
              </div>
            )}
          </div>

          {err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : null}

          {/* QR hiển thị tại chỗ nếu backend trả về */}
          {(qr.img || qr.svg) && (
            <div className="mt-2 flex flex-col items-center gap-2">
              {qr.svg ? (
                <div
                  className="w-56 h-56"
                  dangerouslySetInnerHTML={{ __html: qr.svg }}
                />
              ) : (
                <img src={qr.img} alt="QR" className="w-56 h-56 object-contain" />
              )}
              <div className="text-xs text-slate-500">Quét QR để hoàn tất ủng hộ</div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Đóng</button>
          <button
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-60"
            disabled={!gateways?.length || submitting || Number(amount) < 10000}
            onClick={createDonation}
          >
            {submitting ? "Đang tạo…" : "Tạo giao dịch"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Card ========== */
function CampaignCard({ c, onDonate }) {
  const cover = c.cover || c.images?.[0] || "/images/campaign-placeholder.jpg";
  const raised = Number(c.raised || 0);
  const goal = Number(c.goal || 0);
  const pct = Math.min(100, Math.round((raised / (goal || 1)) * 100));
  const daysLeft =
    c.deadline ? Math.max(0, Math.ceil((new Date(c.deadline) - new Date()) / 86400000)) : null;

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

        {/* Nút hành động */}
        <div className="pt-2 flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => onDonate(c)}
          >
            Ủng hộ
          </button>
          <a
            href={`/reports?campaign_id=${encodeURIComponent(c.id)}`}
            className="px-4 py-2 rounded-xl border hover:bg-slate-50"
            title="Xem sao kê/ báo cáo minh bạch"
          >
            Sao kê
          </a>
        </div>
      </div>
    </div>
  );
}

/* ========== Page ========== */
export default function Campaigns() {
  const location = useLocation();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filters, setFilters] = useState({ diet: false, expiring: false, activeOnly: true });

  // Gateways từ DB
  const [gateways, setGateways] = useState([]);
  const [gwErr, setGwErr] = useState("");

  // Modal
  const [donateOpen, setDonateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // debounce search
  const [qDebounced, setQDebounced] = useState("");
  const typingTimer = useRef(null);
  useEffect(() => {
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(typingTimer.current);
  }, [q]);

  // load campaigns
  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const data = await apiGet("/api/campaigns", { signal: ac.signal });
        if (!isMounted) return;
        setRaw(Array.isArray(data) ? data : data.items || []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Không thể tải danh sách chiến dịch.");
          setRaw([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => { isMounted = false; ac.abort(); };
  }, [location.key]);

  // load payment gateways từ DB
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setGwErr("");
        // Ưu tiên endpoint chuyên dụng
        let gws = await apiGet("/api/payments/gateways").catch(() => null);
        // Fallback: đọc từ site_settings (key: payment_gateways)
        if (!gws) {
          const s = await apiGet("/api/site-settings?key=payment_gateways").catch(() => null);
          gws = s?.value || s?.items || [];
        }
        if (!Array.isArray(gws)) gws = [];
        // lọc những cổng đang bật (enabled)
        gws = gws
          .map((x) => (typeof x === "string" ? { code: x, name: x } : x))
          .filter((x) => x && (x.enabled === undefined || x.enabled));
        if (mounted) setGateways(gws);
      } catch (e) {
        if (mounted) {
          setGateways([]);
          setGwErr("Không lấy được cấu hình cổng thanh toán. Vẫn có thể ủng hộ bằng QR khi có sẵn.");
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const list = useMemo(() => {
    const pct = (c) => {
      const raised = Number(c.raised || 0);
      const goal = Number(c.goal || 0);
      return Math.min(100, Math.round((raised / (goal || 1)) * 100));
    };
    const daysLeft = (c) =>
      c.deadline ? Math.ceil((new Date(c.deadline) - new Date()) / 86400000) : Infinity;

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
      arr = arr.slice().sort((a, b) => {
        const da = daysLeft(a); const db = daysLeft(b);
        if (da !== db) return da - db;
        return pct(a) - pct(b);
      });
    }
    if (sortBy === "progress") arr = arr.slice().sort((a, b) => pct(b) - pct(a));
    else if (sortBy === "supporters") arr = arr.slice().sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    else if (sortBy === "endingSoon") arr = arr.slice().sort((a, b) => daysLeft(a) - daysLeft(b));
    else if (sortBy === "newest")
      arr = arr.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return arr;
  }, [raw, qDebounced, filters, sortBy]);

  function openDonate(campaign) {
    setSelectedCampaign(campaign);
    setDonateOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="text-xl font-semibold flex-1">Chiến dịch đang chạy</div>
          <div className="flex gap-2 flex-wrap items-center">
            <input className="input w-64" placeholder="Tìm theo tiêu đề, mô tả, tag, địa điểm…"
                   value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="progress">Tiến độ</option>
              <option value="supporters">Nhiều ủng hộ</option>
              <option value="endingSoon">Sắp kết thúc</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.activeOnly}
                     onChange={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))} />
              Đang hoạt động
            </label>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.diet}
                     onChange={() => setFilters((f) => ({ ...f, diet: !f.diet }))} />
              Ăn chay
            </label>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border bg-white">
              <input type="checkbox" checked={filters.expiring}
                     onChange={() => setFilters((f) => ({ ...f, expiring: !f.expiring }))} />
              Sắp hết hạn
            </label>
          </div>
        </div>
        {gwErr ? <div className="mt-2 text-sm text-amber-700">{gwErr}</div> : null}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Người ủng hộ" value={raw.reduce((a, c) => a + (c.supporters || 0), 0).toLocaleString("vi-VN")} />
        <Stat label="Đã gây quỹ" value={(raw.reduce((a, c) => a + (Number(c.raised) || 0), 0)).toLocaleString("vi-VN") + " đ"} />
        <Stat label="Khẩu phần" value={(raw.reduce((a, c) => a + (Number(c.meals) || 0), 0) || 0).toLocaleString("vi-VN")} />
        <Stat label="Chiến dịch" value={raw.length} />
      </div>

      {/* Body */}
      {err ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-red-600">{err}</div>
      ) : loading ? (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-slate-600">
          Chưa có chiến dịch phù hợp.
        </div>
      ) : (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => <CampaignCard key={c.id} c={c} onDonate={openDonate} />)}
        </div>
      )}

      {/* Modal Ủng hộ */}
      <DonateModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        campaign={selectedCampaign}
        gateways={gateways}
      />
    </div>
  );
}
