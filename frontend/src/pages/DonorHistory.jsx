import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { ChevronRight, Clock, HandCoins, Utensils } from "lucide-react";

/* ======= UI helpers ======= */
const fmtCurrency = (n) =>
  (Number(n || 0)).toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const StatusBadge = ({ status }) => {
  const map = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    failed:  "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const label = { success: "Thành công", pending: "Chờ xử lý", failed: "Thất bại" }[status] || status;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || "bg-slate-50 text-slate-600 ring-1 ring-slate-200"}`}>
      {label}
    </span>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-300 bg-white shadow-[0_1px_0_#e5e7eb,0_6px_24px_rgba(0,0,0,0.06)] ${className}`}>
    {children}
  </div>
);

const SkeletonRow = () => (
  <div className="p-4 rounded-xl border bg-white animate-pulse flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-slate-200" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 rounded w-1/2" />
      <div className="h-3 bg-slate-200 rounded w-1/3" />
    </div>
    <div className="h-4 bg-slate-200 rounded w-24" />
  </div>
);

/* ======= Page ======= */
export default function DonorHistory() {
  const [data, setData] = useState(null);
  const [tab, setTab]   = useState("all"); // all | money | meal

  useEffect(() => {
    apiGet("/api/donor/donations?page=1&pageSize=50")
      .then(setData)
      .catch(() => setData([]));
  }, []);

  const filtered = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (tab === "all") return data;
    if (tab === "money") return data.filter(d => d.unit !== "meal");
    return data.filter(d => d.unit === "meal");
  }, [data, tab]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Lịch sử quyên góp</h1>
        <p className="text-slate-700 mt-1">Xem lại những đóng góp của bạn cho các chiến dịch.</p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {[
          { key: "all",   label: "Tất cả", icon: Clock },
        { key: "money", label: "Tiền",   icon: HandCoins },
          { key: "meal",  label: "Suất ăn", icon: Utensils },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-semibold transition-all",
              tab === key
                ? "bg-slate-900 text-white border-slate-900 shadow"
                : "bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
            ].join(" ")}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* List */}
      {data === null ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-xl font-semibold text-slate-900">Chưa có quyên góp</div>
          <div className="text-slate-600 mt-1">Hãy bắt đầu bằng nút <b>“Quyên góp ngay”</b> ở trang Nhà hảo tâm.</div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(d => {
            const isMeal = d.unit === "meal";
            const rightText = isMeal ? `${d.amount} suất` : fmtCurrency(d.amount);
            const created = new Date(d.created_at);
            return (
              <Link
                key={d.id}
                to={d.campaign?.id ? `/campaigns/${d.campaign.id}` : "#"}
                className="group"
              >
                <div className="p-4 rounded-2xl border border-slate-300 bg-white hover:shadow-[0_1px_0_#e5e7eb,0_12px_28px_rgba(0,0,0,0.08)] transition-all flex items-center gap-4">
                  <img
                    src={d.campaign?.cover || "/images/campaigns/placeholder.jpg"}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-900 truncate">
                        {d.campaign?.title || "Chiến dịch"}
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">
                      {created.toLocaleString("vi-VN")}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-base font-extrabold ${isMeal ? "text-sky-700" : "text-emerald-700"}`}>
                      {rightText}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isMeal ? "Suất ăn" : "Tiền"}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}