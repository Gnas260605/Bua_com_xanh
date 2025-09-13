// src/pages/Delivery.jsx
export default function Delivery() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">Giao – Nhận</h1>
      <p className="text-slate-600">Trang quản lí yêu cầu giao/nhận sẽ đặt ở đây.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-medium mb-1">Tạo yêu cầu nhận đồ ăn</h2>
          <p className="text-sm text-slate-500">Form tạo yêu cầu (placeholder).</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="font-medium mb-1">Danh sách chuyến giao</h2>
          <p className="text-sm text-slate-500">Bảng chuyến giao (placeholder).</p>
        </div>
      </div>
    </div>
  );
}
