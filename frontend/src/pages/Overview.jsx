import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
// ❌ import Layout from "../components/layout/Layout";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { Search, Tag, AlertTriangle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

function FoodCard({ item }) {
  const cover =
    item.images?.[0] ||
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop";
  return (
    <Card className="overflow-hidden">
      <img src={cover} alt="" className="h-40 w-full object-cover" />
      <div className="p-4 space-y-2">
        <div className="font-semibold line-clamp-1">{item.title}</div>
        <div className="text-sm text-slate-600 line-clamp-2">{item.description}</div>
        <div className="text-sm">
          Còn <b>{item.qty}</b> {item.unit} • HSD {new Date(item.expire_at).toLocaleString("vi-VN")}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(item.tags || []).map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
        </div>
        <div className="text-xs text-slate-500">Địa điểm: {item.location_addr}</div>
      </div>
    </Card>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [foods, setFoods] = useState({ items: [], total: 0, page: 1, pageSize: 9 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campErr, setCampErr] = useState("");

  useEffect(() => {
    apiGet("/api/overview").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ q, tag, page, pageSize: 9 }).toString();
    apiGet(`/api/foods?${qs}`).then(setFoods).finally(() => setLoading(false));
  }, [q, tag, page]);

  useEffect(() => {
    (async () => {
      try {
        await apiGet("/api/campaigns?limit=1");
        setCampErr("");
      } catch {
        setCampErr("API /api/campaigns chưa sẵn sàng • bỏ qua phần Chiến dịch.");
      }
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(foods.total / (foods.pageSize || 9)));

  return (
    <>
      {/* Banner */}
      <Card className="p-5 mb-5 bg-gradient-to-br from-emerald-50 to-sky-50">
        <div className="text-lg font-semibold">
          Kết nối bữa ăn dư thừa tới người cần • An toàn • Minh bạch
        </div>
      </Card>

      {!!campErr && (
        <Card className="p-3 mb-4 flex items-center gap-2 text-amber-700 bg-amber-50 border-amber-200">
          <AlertTriangle size={18} /> <span>{campErr}</span>
        </Card>
      )}

      {/* Toolbar */}
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
        <div className="ml-auto">
          {user?.role === "admin" && (
            <Button onClick={() => nav("/campaigns?create=1")}>+ Tạo chiến dịch</Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { k: "users", label: "Người dùng" },
          { k: "donors", label: "Nhà hảo tâm" },
          { k: "recipients", label: "Người nhận" },
          { k: "campaigns", label: "Chiến dịch" },
        ].map((c) => (
          <Card key={c.k} className="p-4">
            <div className="text-slate-500 text-sm">{c.label}</div>
            <div className="text-3xl font-bold">{stats ? stats[c.k] || 0 : "…"}</div>
          </Card>
        ))}
      </div>

      {/* Foods */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Bữa cơm đang có</div>
        <div className="text-sm text-slate-500">{foods.total} mục</div>
      </div>

      {loading ? (
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
              Trang {page}/{totalPages}
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
