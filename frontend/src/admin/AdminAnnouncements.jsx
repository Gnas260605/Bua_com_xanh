import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const t = useToast();

  async function load() {
    try { setItems(await apiGet("/api/admin/announcements")); }
    catch { setItems([]); }
  }
  useEffect(()=>{ load(); }, []);

  async function save(a) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const isNew = !a?.id;
    const r = await fetch(`${API_BASE}/api/admin/announcements${isNew?"":`/${a.id}`}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(a),
    });
    if (!r.ok) return t.error("Lỗi lưu");
    t.success("Đã lưu"); setEditing(null); load();
  }
  async function remove(id) {
    if (!confirm("Xoá thông báo này?")) return;
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/announcements/${id}`, { method:"DELETE", headers: { ...(token?{Authorization:`Bearer ${token}`}:{}) }});
    if (!r.ok) return t.error("Không xoá được");
    t.info("Đã xoá"); load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={()=>setEditing({ title:"", content:"", level:"info", active:1 })}>Tạo thông báo</Button>
        <Button className="ml-auto" onClick={load}>Làm mới</Button>
      </div>

      <Card className="p-0">
        {!items.length ? <Empty title="Chưa có thông báo" /> :
        <ul className="divide-y">
          {items.map(a=>(
            <li key={a.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{a.title} <span className="text-xs text-slate-500">({a.level}{a.active? ", active":", off"})</span></div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={()=>setEditing(a)}>Sửa</Button>
                  <Button variant="ghost" onClick={()=>remove(a.id)}>Xoá</Button>
                </div>
              </div>
              <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content?.slice(0,240)}</div>
            </li>
          ))}
        </ul>}
      </Card>

      {editing && (
        <dialog open className="rounded-2xl p-0">
          <div className="p-5 w-[min(92vw,720px)] space-y-3">
            <div className="text-lg font-semibold">{editing.id?"Sửa thông báo":"Tạo thông báo"}</div>
            <input className="input w-full" placeholder="Tiêu đề" value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/>
            <select className="input" value={editing.level} onChange={e=>setEditing({...editing,level:e.target.value})}>
              <option value="info">info</option><option value="success">success</option><option value="warning">warning</option><option value="danger">danger</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.active} onChange={e=>setEditing({...editing,active:e.target.checked?1:0})}/> Active
            </label>
            <textarea className="input w-full min-h-48" placeholder="Nội dung" value={editing.content||""} onChange={e=>setEditing({...editing,content:e.target.value})}/>
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
