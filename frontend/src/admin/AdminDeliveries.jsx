import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminDeliveries() {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [assign, setAssign] = useState({ booking_id: "", shipper_id: "" });
  const [loading, setLoading] = useState(true);
  const t = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(`/api/admin/deliveries${status ? `?status=${status}` : ""}`);
      setItems(Array.isArray(res) ? res : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [status]);

  async function post(url, body) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error("request failed");
    return r.json();
  }
  async function patch(id, body) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/deliveries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("patch failed");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="assigned">assigned</option>
          <option value="picking">picking</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
        </select>
        <Button onClick={load}>Làm mới</Button>

        <div className="ml-auto flex items-center gap-2">
          <input className="input w-40" placeholder="Booking ID" value={assign.booking_id}
                 onChange={e=>setAssign(s=>({...s, booking_id:e.target.value}))}/>
          <input className="input w-40" placeholder="Shipper ID" value={assign.shipper_id}
                 onChange={e=>setAssign(s=>({...s, shipper_id:e.target.value}))}/>
          <Button onClick={async()=>{
            try { await post("/api/admin/deliveries/assign", assign); t.success("Đã gán"); setAssign({ booking_id:"", shipper_id:"" }); load(); }
            catch { t.error("Không gán được"); }
          }}>Gán shipper</Button>
        </div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Đang tải…</div> :
        !items.length ? <Empty title="Không có bản ghi giao nhận" /> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">ID</th><th className="px-3 py-2">Booking</th>
            <th className="px-3 py-2">Shipper</th><th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2 w-56">Thao tác</th>
          </tr></thead>
          <tbody>
            {items.map(d=>(
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2">{d.id}</td>
                <td className="px-3 py-2">{d.booking_id}</td>
                <td className="px-3 py-2">{d.shipper_id}</td>
                <td className="px-3 py-2">{d.qty}</td>
                <td className="px-3 py-2">{d.status}</td>
                <td className="px-3 py-2 flex gap-2">
                  <Button variant="secondary" onClick={async()=>{ await patch(d.id,{status:"picking"}); t.success("OK"); load(); }}>Picking</Button>
                  <Button onClick={async()=>{ await patch(d.id,{status:"delivered"}); t.success("OK"); load(); }}>Delivered</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </Card>
    </div>
  );
}
