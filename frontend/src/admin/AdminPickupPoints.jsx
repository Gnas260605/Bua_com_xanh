import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminPickupPoints() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const t = useToast();

  async function load() {
    try { const res = await apiGet(`/api/admin/pickup-points?q=${encodeURIComponent(q)}`); setItems(res || []); }
    catch { setItems([]); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, []);

  async function save(p) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const isNew = !p?.id;
    const r = await fetch(`${API_BASE}/api/admin/pickup-points${isNew?"":`/${p.id}`}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(p),
    });
    if (!r.ok) { t.error("Lỗi lưu"); return; }
    t.success("Đã lưu");
    setEditing(null);
    load();
  }
  async function remove(id) {
    if (!confirm("Xoá điểm hẹn này?")) return;
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/pickup-points/${id}`, { method: "DELETE", headers: { ...(token?{Authorization:`Bearer ${token}`}:{}) }});
    if (!r.ok) { t.error("Không xoá được"); return; }
    t.info("Đã xoá"); load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input className="input" placeholder="Tìm theo tên…" value={q} onChange={e=>setQ(e.target.value)}/>
        <Button onClick={load}>Tìm</Button>
        <Button className="ml-auto" onClick={()=>setEditing({ name:"", address:"", lat:null, lng:null, active:1 })}>Thêm điểm hẹn</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {!items.length ? <Empty title="Chưa có điểm hẹn"/> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">Tên</th><th className="px-3 py-2">Địa chỉ</th><th className="px-3 py-2">Lat/Lng</th>
            <th className="px-3 py-2">Hoạt động</th><th className="px-3 py-2 w-48">Thao tác</th>
          </tr></thead>
          <tbody>
            {items
              .filter(i => !q || (i.name||"").toLowerCase().includes(q.toLowerCase()))
              .map(p=>(
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.address || "-"}</td>
                <td className="px-3 py-2">{[p.lat,p.lng].filter(v=>v!=null).join(", ")}</td>
                <td className="px-3 py-2">{p.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 flex gap-2">
                  <Button variant="secondary" onClick={()=>setEditing(p)}>Sửa</Button>
                  <Button variant="ghost" onClick={()=>remove(p.id)}>Xoá</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </Card>

      {editing && (
        <dialog open className="rounded-2xl p-0">
          <div className="p-5 w-[min(92vw,560px)] space-y-3">
            <div className="text-lg font-semibold">{editing.id?"Sửa điểm hẹn":"Thêm điểm hẹn"}</div>
            <input className="input w-full" placeholder="Tên" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>
            <input className="input w-full" placeholder="Địa chỉ" value={editing.address||""} onChange={e=>setEditing({...editing,address:e.target.value})}/>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Lat" value={editing.lat ?? ""} onChange={e=>setEditing({...editing,lat:e.target.value===""?null:Number(e.target.value)})}/>
              <input className="input" placeholder="Lng" value={editing.lng ?? ""} onChange={e=>setEditing({...editing,lng:e.target.value===""?null:Number(e.target.value)})}/>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.active} onChange={e=>setEditing({...editing,active:e.target.checked?1:0})}/> Hoạt động
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={()=>setEditing(null)}>Đóng</Button>
              <Button onClick={()=>save(editing)}>Lưu</Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
