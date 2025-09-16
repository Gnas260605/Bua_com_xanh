import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { MapPin, Search, Copy, ExternalLink, CheckCircle2 } from "lucide-react";

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-300 bg-white shadow-[0_1px_0_#e5e7eb,0_8px_24px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
);

const toGmaps = (lat, lng, address) =>
  lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;

export default function DonorPickup() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [defaultId, setDefaultId] = useState(() => localStorage.getItem("bxc.defaultPickup") || null);

  useEffect(() => {
    apiGet("/api/donor/pickup-points")
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]));
  }, []);

  const list = useMemo(() => {
    if (!items) return null;
    const kw = q.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (it) =>
        (it.name || "").toLowerCase().includes(kw) ||
        (it.address || "").toLowerCase().includes(kw)
    );
  }, [items, q]);

  function setDefault(id) {
    setDefaultId(id);
    localStorage.setItem("bxc.defaultPickup", id || "");
  }

  function copy(text) {
    navigator.clipboard?.writeText(text || "");
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Điểm giao nhận</h1>
        <p className="text-slate-700 mt-1">Chọn điểm gần bạn để giao–nhận nhanh chóng.</p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 bg-white">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc địa chỉ…"
            className="flex-1 outline-none"
          />
        </div>
      </div>

      {!list ? (
        <Card className="p-8 text-center text-slate-600">Đang tải…</Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-xl font-semibold text-slate-900">Chưa có điểm nào</div>
          <div className="text-slate-600 mt-1">Vui lòng liên hệ quản trị để thêm điểm mới.</div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((it) => {
            const isDefault = String(defaultId || "") === String(it.id || "");
            return (
              <Card key={it.id} className="p-4 hover:shadow-[0_1px_0_#e5e7eb,0_12px_28px_rgba(0,0,0,0.08)] transition-all">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-violet-50 border border-violet-200">
                    <MapPin className="h-6 w-6 text-violet-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-900 truncate">{it.name}</div>
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4" /> Mặc định
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5 truncate">{it.address}</div>
                    {it.lat && it.lng && (
                      <div className="text-xs text-slate-500 mt-0.5">({it.lat}, {it.lng})</div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setDefault(it.id)}
                        className={`px-3 py-1.5 rounded-2xl border text-sm font-semibold ${
                          isDefault ? "bg-emerald-600 text-white border-emerald-600" : "hover:bg-slate-50"
                        }`}
                      >
                        Đặt mặc định
                      </button>
                      <a
                        href={toGmaps(it.lat, it.lng, it.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-2xl border text-sm hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" /> Mở bản đồ
                      </a>
                      <button
                        onClick={() => copy(`${it.name} - ${it.address}`)}
                        className="px-3 py-1.5 rounded-2xl border text-sm hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <Copy className="h-4 w-4" /> Sao chép
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
