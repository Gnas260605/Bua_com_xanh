import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { apiGet } from "../lib/api";

export default function AdminAudit() {
  const [q, setQ] = useState({ actor:"", action:"", target:"" });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const url = `/api/admin/audit?actor=${q.actor}&action=${encodeURIComponent(q.action)}&target=${encodeURIComponent(q.target)}&page=1&pageSize=50`;
      const res = await apiGet(url);
      setData(res || { items: [], total: 0 });
    } catch { setData({ items: [], total: 0 }); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-4 gap-2">
        <input className="input" placeholder="actor_id" value={q.actor} onChange={e=>setQ(s=>({...s,actor:e.target.value}))}/>
        <input className="input" placeholder="action contains…" value={q.action} onChange={e=>setQ(s=>({...s,action:e.target.value}))}/>
        <input className="input" placeholder="target contains…" value={q.target} onChange={e=>setQ(s=>({...s,target:e.target.value}))}/>
        <Button onClick={load}>Lọc</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? <div className="p-6 text-sm text-slate-500">Đang tải…</div> :
        !data.items.length ? <Empty title="Không có log" /> :
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left">
            <th className="px-3 py-2">Thời gian</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Detail</th>
          </tr></thead>
          <tbody>
            {data.items.map((r)=>(
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">{r.created_at}</td>
                <td className="px-3 py-2">{r.actor_id}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2">{r.target_id}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-pre-wrap break-words">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>}
      </Card>
    </div>
  );
}
