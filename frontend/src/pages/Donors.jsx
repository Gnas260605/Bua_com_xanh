import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import EmptyState from "../components/ui/Empty";

import { Skeleton } from "../components/ui/Skeleton";

function UserRow({u}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <img src={u.avatar_url || "/images/avatar-default.png"} className="h-10 w-10 rounded-full object-cover" alt=""/>
      <div className="flex-1">
        <div className="font-medium">{u.name || u.email}</div>
        <div className="text-sm text-slate-500">{u.email}</div>
      </div>
      <div className="text-xs text-slate-500">{u.status}</div>
    </div>
  );
}

export default function Donors(){
  const [list,setList] = useState(null);
  useEffect(()=>{ apiGet("/api/users?role=donor").then(setList).catch(()=>setList([])); },[]);
  if (!list) return <div className="grid gap-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-16"/>)}</div>;
  if (list.length===0) return <EmptyState title="Chưa có nhà hảo tâm" />;
  return <div className="grid gap-3">{list.map(u => <UserRow key={u.id} u={u} />)}</div>;
}
