import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import EmptyState from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export default function Shippers(){
  const [list,setList] = useState(null);
  useEffect(()=>{ apiGet("/api/users?role=shipper").then(setList).catch(()=>setList([])); },[]);
  if (!list) return <div className="grid gap-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-16"/>)}</div>;
  if (list.length===0) return <EmptyState title="Chưa có shipper tình nguyện" />;
  return <div className="grid gap-3">{list.map(u => (
    <div key={u.id} className="card p-4 flex items-center gap-3">
      <div className="text-2xl">🚚</div>
      <div className="flex-1">
        <div className="font-medium">{u.name || u.email}</div>
        <div className="text-sm text-slate-500">{u.email}</div>
      </div>
      <div className="text-xs text-slate-500">{u.status}</div>
    </div>
  ))}</div>;
}
