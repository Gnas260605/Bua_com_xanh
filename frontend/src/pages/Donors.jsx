import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { Gift, History, MapPin, MessageSquare } from "lucide-react";

/* ========================= UI PRIMITIVES (high-contrast) ========================= */
const Card = ({ className = "", children }) => (
  <div
    className={[
      // Nền đặc + border rõ ràng + bóng nhẹ
      "rounded-2xl border border-slate-300 bg-white shadow-[0_1px_0_#e5e7eb,0_1px_8px_rgba(0,0,0,0.04)]",
      // Loại bỏ tất cả blur/opacity để chữ sắc nét
      "transition-all hover:shadow-[0_1px_0_#e5e7eb,0_6px_20px_rgba(0,0,0,0.06)]",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const SectionTitle = ({ children, action }) => (
  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
    <h2 className="text-base font-semibold text-slate-900">{children}</h2>
    {action}
  </div>
);

function CTA({ to, icon: Icon, label, desc, color = "emerald" }) {
  const colorMap = {
    emerald: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300",
    sky: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-300",
    violet: "bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-300",
    rose: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300",
  };
  return (
    <Link
      to={to}
      className={[
        "rounded-2xl px-5 py-4 text-white",
        "shadow-[0_1px_0_rgba(0,0,0,0.03),0_10px_24px_rgba(0,0,0,0.08)]",
        "focus-visible:outline-none focus-visible:ring-4",
        colorMap[color],
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">{label}</div>
          {desc && (
            <div className="text-sm/5 opacity-95">{desc}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ========================= PAGE ========================= */
export default function Donors() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    apiGet("/api/donor/me").then(setMe).catch(() => setMe({}));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Header: chữ đậm, tương phản cao */}
      <div className="flex items-center gap-4 mb-5">
        <img
          src={me?.avatar_url || "/images/avatar-default.png"}
          className="h-14 w-14 rounded-full object-cover border border-slate-300"
          alt=""
        />
        <div>
          <div className="text-sm text-slate-600">Xin chào,</div>
          <h1 className="text-2xl font-bold text-slate-900">
            {me?.name || "Nhà hảo tâm"}
          </h1>
          <p className="text-sm text-slate-700">
            Cảm ơn bạn đã đồng hành cùng Bữa Cơm Xanh 🌱
          </p>
        </div>
      </div>

      {/* Actions: 4 ô lớn, màu rõ, không blur */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <CTA
          to="/donor/donate"
          icon={Gift}
          label="Quyên góp ngay"
          desc="Tạo món/bữa cơm mới"
          color="emerald"
        />
        <CTA
          to="/donor/history"
          icon={History}
          label="Lịch sử quyên góp"
          desc="Xem các lần đã ủng hộ"
          color="sky"
        />
        <CTA
          to="/donor/pickup"
          icon={MapPin}
          label="Điểm giao nhận"
          desc="Chọn/thiết lập địa điểm"
          color="violet"
        />
        <CTA
          to="/support/chat"
          icon={MessageSquare}
          label="Hỗ trợ / Chat"
          desc="Kết nối nhanh với đội ngũ"
          color="rose"
        />
      </div>

      {/* Khối nội dung dưới: dùng Card trắng + border rõ */}
      <Card>
        <SectionTitle
          action={
            <Link
              to="/donor/donations"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              Xem tất cả
            </Link>
          }
        >
          Quyên góp gần đây
        </SectionTitle>

        <div className="px-5 py-8 text-center">
          <div className="text-slate-900 font-medium">Chưa có dữ liệu</div>
          <div className="text-sm text-slate-600">
            Hãy tạo quyên góp đầu tiên của bạn bằng nút <b>“Quyên góp ngay”</b>.
          </div>
        </div>
      </Card>
    </div>
  );
}
