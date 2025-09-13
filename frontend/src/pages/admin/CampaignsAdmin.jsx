import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Empty from "../../components/ui/Empty";
import { apiGet } from "../../lib/api";

export default function CampaignsAdmin() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q, status, page: String(page), pageSize: String(pageSize),
      }).toString();
      const res = await apiGet(`/api/admin/campaigns?${qs}`);
      setItems(res?.items || []);
      setTotal(res?.total || 0);
    } catch {
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status, page]);

  async function updateStatus(id, newStatus) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-2xl font-bold">Quản lý chiến dịch</div>

      <Card className="p-3 flex items-center gap-3">
        <input className="input" placeholder="Tìm theo tiêu đề/mô tả…" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="input w-48" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <Button onClick={()=>setPage(1)}>Lọc</Button>
        <div className="ml-auto text-sm text-slate-500">Tổng: {total}</div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>ID</th><th>Tiêu đề</th><th>Trạng thái</th><th>Mục tiêu</th>
              <th>Đã gây quỹ</th><th>Bắt đầu</th><th>Kết thúc</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-4 text-center text-slate-500">Đang tải…</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={8} className="p-4"><Empty title="Chưa có chiến dịch" /></td></tr>
            ) : items.map(c => (
              <tr key={c.id} className="border-t [&>td]:px-3 [&>td]:py-2">
                <td>{c.id}</td>
                <td className="font-medium">{c.title}</td>
                <td>{c.status}</td>
                <td>{(c.target_amount ?? 0).toLocaleString("vi-VN")}đ</td>
                <td>{(c.raised_amount ?? 0).toLocaleString("vi-VN")}đ</td>
                <td>{c.start_at || "-"}</td>
                <td>{c.end_at || "-"}</td>
                <td className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={()=>updateStatus(c.id, "active")}>Kích hoạt</Button>
                    <Button variant="secondary" onClick={()=>updateStatus(c.id, "archived")}>Lưu trữ</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {total > pageSize && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Trang trước</Button>
          <div className="text-sm">Trang {page} / {Math.ceil(total/pageSize)}</div>
          <Button variant="secondary" disabled={page>=Math.ceil(total/pageSize)} onClick={()=>setPage(p=>p+1)}>Trang sau</Button>
        </div>
      )}
    </div>
  );
}
