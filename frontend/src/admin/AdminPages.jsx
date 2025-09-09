import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function AdminPages() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = useToast();

  async function load() {
    setLoading(true);
    try { setItems(await apiGet("/api/admin/pages")); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function save(p) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const isNew = !p?.id;
    const r = await fetch(`${API_BASE}/api/admin/pages${isNew?"":`/${p.id}`}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify(p),
    });
    if (!r.ok) return t.error("Lỗi lưu");
    t.success("Đã lưu");
    setEditing(null); load();
  }
  async function remove(id) {
    if (!confirm("Xoá trang này?")) return;
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/pages/${id}`, { method:"DELETE", headers: { ...(token?{Authorization:`Bearer ${token}`}:{}) }});
    if (!r.ok) return t.error("Không xoá được");
    t.info("Đã xoá"); load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={()=>setEditing({ slug:"", title:"", content:"", status:"draft" })}>Tạo trang</Button>
        <Button className="ml-auto" onClick={load}>Làm mới</Button>
      </div>

      <Card className="p-0">
        {loading ? <div className="p-6 text-sm text-slate-500">Đang tải…</div> :
        !items.length ? <Empty title="Chưa có trang CMS" /> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">Slug</th><th className="px-3 py-2">Tiêu đề</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2 w-48">Thao tác</th>
          </tr></thead>
          <tbody>
            {items.map(p=>(
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-mono">{p.slug}</td>
                <td className="px-3 py-2">{p.title}</td>
                <td className="px-3 py-2">{p.status}</td>
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
          <div className="p-5 w-[min(92vw,780px)] space-y-3">
            <div className="text-lg font-semibold">{editing.id?"Sửa trang":"Tạo trang"}</div>
            <input className="input w-full" placeholder="Slug" value={editing.slug} onChange={e=>setEditing({...editing, slug:e.target.value})}/>
            <input className="input w-full" placeholder="Tiêu đề" value={editing.title} onChange={e=>setEditing({...editing, title:e.target.value})}/>
            <select className="input" value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
            <textarea className="input w-full min-h-56" placeholder="Nội dung (Markdown/HTML)" value={editing.content || ""} onChange={e=>setEditing({...editing, content:e.target.value})}/>
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
