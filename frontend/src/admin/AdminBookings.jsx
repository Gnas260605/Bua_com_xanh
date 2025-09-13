import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminBookings() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const t = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(`/api/admin/bookings?status=${status}&q=${encodeURIComponent(q)}`);
      setData(res || { items: [], total: 0 });
    } catch { setData({ items: [], total: 0 }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function patch(id, body) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("patch failed");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input className="input" placeholder="Tìm nhanh…" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="cancelled">cancelled</option>
          <option value="completed">completed</option>
        </select>
        <Button onClick={load}>Làm mới</Button>
        <Button variant="ghost" className="ml-auto" onClick={async ()=>{
          const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
          const r = await fetch(`${API_BASE}/api/admin/bookings/auto-cancel`, {
            method: "POST", headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ pending_hours: 24 })
          });
          t.info((await r.json())?.ok ? "Đã auto-cancel" : "Không có thay đổi");
          load();
        }}>Auto-cancel 24h</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Đang tải…</div> :
        !data.items.length ? <Empty title="Không có booking" /> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Donor</th>
            <th className="px-3 py-2">Receiver</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2 w-56">Thao tác</th>
          </tr></thead>
          <tbody>
            {data.items
              .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()))
              .map(b=>(
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2">{b.id}</td>
                <td className="px-3 py-2">{b.donor_id || "-"}</td>
                <td className="px-3 py-2">{b.receiver_id || "-"}</td>
                <td className="px-3 py-2">{b.qty}</td>
                <td className="px-3 py-2">{b.status}</td>
                <td className="px-3 py-2 flex gap-2">
                  <Button variant="secondary" onClick={async()=>{ await patch(b.id, { status:"approved" }); t.success("OK"); load(); }}>Duyệt</Button>
                  <Button variant="ghost" onClick={async()=>{ await patch(b.id, { status:"cancelled" }); t.info("Đã huỷ"); load(); }}>Huỷ</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </Card>
    </div>
  );
}
