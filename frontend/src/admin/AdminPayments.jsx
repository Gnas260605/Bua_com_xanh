import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminPayments() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const t = useToast();

  async function load() {
    setLoading(true);
    try { setData(await apiGet(`/api/admin/payments?status=${status}`)); }
    catch { setData({ items: [], total: 0 }); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [status]);

  async function patch(id, nextStatus) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify({ status: nextStatus })
    });
    if (!r.ok) return t.error("Không cập nhật được");
    t.success("Đã cập nhật");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="success">success</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="refunded">refunded</option>
        </select>
        <Button onClick={load}>Làm mới</Button>
        <div className="ml-auto text-sm text-slate-500">Tổng: {data.total}</div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Đang tải…</div> :
        !data.items.length ? <Empty title="Không có giao dịch" /> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">ID</th><th className="px-3 py-2">Payer</th><th className="px-3 py-2">Số tiền</th>
            <th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2 w-56">Thao tác</th>
          </tr></thead>
          <tbody>
          {data.items.map(p=>(
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">{p.id}</td>
              <td className="px-3 py-2">{p.payer_id}</td>
              <td className="px-3 py-2">{(p.amount||0).toLocaleString("vi-VN")}đ</td>
              <td className="px-3 py-2">{p.status}</td>
              <td className="px-3 py-2 flex gap-2">
                <Button variant="secondary" onClick={()=>patch(p.id,"success")}>Mark success</Button>
                <Button variant="ghost" onClick={()=>patch(p.id,"refunded")}>Refund</Button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>}
      </Card>
    </div>
  );
}
