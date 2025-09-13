export default function Logistics(){
  return (
    <div className="space-y-6">
      <div className="text-2xl font-bold">Tạo yêu cầu nhận/ giao</div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><div className="text-sm text-slate-600">Người liên hệ</div><input className="input" placeholder="Họ tên"/></div>
            <div><div className="text-sm text-slate-600">SĐT</div><input className="input" placeholder="09x..."/></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><div className="text-sm text-slate-600">Điểm lấy hàng</div><input className="input" placeholder="Địa chỉ"/></div>
            <div><div className="text-sm text-slate-600">Điểm trao/ phát</div><input className="input" placeholder="Địa chỉ"/></div>
          </div>
          <div>
            <div className="text-sm text-slate-600">Ghi chú</div>
            <textarea className="input min-h-[120px]" placeholder="Ví dụ: cần thùng giữ nhiệt..."/>
          </div>
          <button className="btn-primary w-fit">Tạo lệnh giao nhận</button>
        </div>
        <aside className="card p-5">
          <div className="font-medium mb-2">Bản đồ lộ trình (demo)</div>
          <div className="h-64 rounded-xl border border-dashed border-slate-300 grid place-items-center text-slate-500">Embed map/route here</div>
          <div className="text-xs text-slate-500 mt-2">Tích hợp sau: Google Maps Directions API hoặc OpenStreetMap.</div>
        </aside>
      </div>
    </div>
  );
}
