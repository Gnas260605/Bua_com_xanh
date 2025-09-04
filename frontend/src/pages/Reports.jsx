import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";

export default function Reports(){
  const [stats,setStats] = useState(null);
  useEffect(()=>{ apiGet("/api/overview").then(setStats).catch(()=>setStats({})); },[]);

  if (!stats) {
    return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-28"/>)}
    </div>;
  }

  const series = [ // ví dụ dummy nếu backend chưa trả
    { label:"T1", v: (stats.users||0) },
    { label:"T2", v: (stats.donors||0)+1 },
    { label:"T3", v: (stats.recipients||0)+2 },
    { label:"T4", v: (stats.campaigns||0)+3 },
  ];
  const max = Math.max(...series.map(s=>s.v), 1);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><div className="text-sm text-slate-500">Người dùng</div><div className="text-3xl font-bold">{stats.users||0}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Nhà hảo tâm</div><div className="text-3xl font-bold">{stats.donors||0}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Người nhận</div><div className="text-3xl font-bold">{stats.recipients||0}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Chiến dịch</div><div className="text-3xl font-bold">{stats.campaigns||0}</div></div>
      </div>

      <div className="card p-6">
        <div className="font-semibold mb-3">Thống kê theo tháng</div>
        {series.length===0 ? <EmptyState title="Chưa đủ dữ liệu" /> : (
          <div className="flex items-end gap-4 h-48">
            {series.map(s => (
              <div key={s.label} className="flex-1 text-center">
                <div className="mx-auto w-8 bg-emerald-400 rounded-t-xl" style={{height:`${(s.v/max)*100}%`}}/>
                <div className="mt-2 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
