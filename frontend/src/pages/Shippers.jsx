import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import EmptyState from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export default function Shippers() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [selected, setSelected] = useState(null);

  // ✅ Chỉ shipper được phép vào
  if (!user || user.role !== "shipper") {
    return <EmptyState title="Bạn không có quyền truy cập trang này" />;
  }

  useEffect(() => {
    apiGet("/api/orders?status=pending&area=yourZone")
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  if (!orders)
    return (
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );

  if (orders.length === 0)
    return <EmptyState title="Chưa có đơn hàng nào" />;

  function handleAccept(order) {
    apiPost(`/api/orders/${order.id}/accept`).then(() => {
      setSelected(order);
    });
  }

  function handleUpdate(order, status) {
    apiPost(`/api/orders/${order.id}/status`, { status }).then(() => {
      setSelected({ ...order, status });
    });
  }

  return (
    <div className="grid gap-4">
      {!selected &&
        orders.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="font-semibold">{o.title}</div>
            <div className="text-sm text-slate-500">
              Người nhận: {o.receiver?.name}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                className="btn btn-primary"
                onClick={() => handleAccept(o)}
              >
                Nhận đơn
              </button>
            </div>
          </div>
        ))}

      {selected && (
        <div className="card p-4">
          <div className="font-semibold">Đơn #{selected.id}</div>
          <div className="text-sm">Người nhận: {selected.receiver?.name}</div>

          {/* Google Maps hướng dẫn */}
          <div className="mt-4">
            <iframe
              title="google-map"
              width="100%"
              height="250"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://www.google.com/maps/embed/v1/directions?key=${
                import.meta.env.VITE_GOOGLE_MAPS_KEY
              }&origin=Current+Location&destination=${encodeURIComponent(
                selected.receiver?.address
              )}`}
            ></iframe>
          </div>

          {/* Nút hành trình */}
          <div className="flex flex-col gap-2 mt-4">
            <button
              className="btn btn-info"
              onClick={() => handleUpdate(selected, "picked_up")}
            >
              ✅ Đã lấy hàng
            </button>
            <button
              className="btn btn-warning"
              onClick={() => handleUpdate(selected, "delivering")}
            >
              🚴 Đang giao
            </button>
            <button
              className="btn btn-success"
              onClick={() => handleUpdate(selected, "delivered")}
            >
              🎉 Hoàn thành giao
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
