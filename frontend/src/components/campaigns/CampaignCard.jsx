export default function CampaignCard({ c }){
  const cover = c.cover || "/images/campaign-1.jpg";
  const pct = Math.min(100, Math.round((c.raised||0) / Math.max(1,c.goal||1) * 100));
  return (
    <div className="card overflow-hidden">
      <img src={cover} alt="" className="h-56 w-full object-cover" />
      <div className="p-4 space-y-3">
        <div className="text-lg font-semibold">{c.title}</div>
        <div className="text-sm text-slate-500">📍 {c.location || "TP.HCM"}</div>
        <div className="progress"><span style={{width: pct+"%"}}/></div>
        <div className="text-sm text-slate-600 flex flex-wrap gap-2">
          <span>Đã gây quỹ <b>{(c.raised||0).toLocaleString("vi-VN")} đ</b> / {(c.goal||0).toLocaleString("vi-VN")} đ</span>
          <span className="ml-auto">{c.supporters||0} ủng hộ</span>
        </div>
        <div className="flex gap-2 flex-wrap">{(c.tags||[]).map(t => <span key={t} className="badge">#{t}</span>)}</div>
        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1">Ủng hộ nhanh</button>
          <button className="btn-ghost px-4">Chi tiết</button>
        </div>
      </div>
    </div>
  );
}
