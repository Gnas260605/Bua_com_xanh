import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";

/**
 * Kiểu dữ liệu notification gợi ý từ backend:
 * {
 *   id: number|string,
 *   title: string,
 *   body?: string,
 *   created_at: string,  // ISO
 *   read: boolean
 * }
 */

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef(null);

  // đóng khi click ngoài
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  // load đếm nhanh (poll nhẹ mỗi 30s)
  useEffect(() => {
    let mounted = true;

    const refreshCount = async () => {
      try {
        const res = await apiGet("/notifications/count?unread=1");
        if (!mounted) return;
        setUnread(Number(res?.count || 0));
      } catch {
        /* im lặng */
      }
    };

    refreshCount();
    const t = setInterval(refreshCount, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // mở dropdown thì tải danh sách
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await apiGet("/notifications?limit=20&order=desc"); // tùy API
        if (!mounted) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setItems(list);
        setUnread(list.filter((n) => !n.read).length);
      } catch (e) {
        setErr("Không tải được thông báo.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open]);

  // đánh dấu đã đọc tất cả (khi người dùng bấm “Đánh dấu đã đọc”)
  const markAllRead = async () => {
    // lạc quan
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await apiPost("/notifications/mark-read", { all: true });
    } catch {
      // nếu lỗi, khôi phục trạng thái gần đúng bằng cách refetch nhanh
      try {
        const res = await apiGet("/notifications?limit=20&order=desc");
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setItems(list);
        setUnread(list.filter((n) => !n.read).length);
      } catch { /* bỏ qua */ }
    }
  };

  // đánh dấu 1 cái đã đọc khi click vào
  const openOne = async (n) => {
    // ví dụ mở link nếu có
    if (n.url) window.location.href = n.url;

    if (!n.read) {
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await apiPost("/notifications/mark-read", { id: n.id });
      } catch { /* bỏ qua */ }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative inline-grid place-items-center w-10 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
        title="Thông báo"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[18px]">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[11px] leading-[18px] rounded-full text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-3 w-[380px] max-w-[92vw] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
          role="menu"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <div className="font-semibold">Thông báo</div>
            <button
              className="text-sm text-emerald-700 hover:underline disabled:opacity-50"
              onClick={markAllRead}
              disabled={unread === 0 || loading}
            >
              Đánh dấu đã đọc
            </button>
          </div>

          {loading && (
            <div className="p-4 text-slate-500 text-sm">Đang tải…</div>
          )}

          {!loading && err && (
            <div className="p-4 text-rose-600 text-sm">{err}</div>
          )}

          {!loading && !err && items.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">Chưa có thông báo.</div>
          )}

          {!loading && !err && items.length > 0 && (
            <ul className="max-h-[420px] overflow-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={[
                    "px-3 py-3 border-b border-slate-100 cursor-pointer",
                    n.read ? "bg-white hover:bg-slate-50" : "bg-emerald-50/60 hover:bg-emerald-50"
                  ].join(" ")}
                  onClick={() => openOne(n)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 select-none">📣</div>
                    <div className="min-w-0">
                      <div className="font-medium text-[15px] truncate">{n.title || "Thông báo"}</div>
                      {n.body && <div className="text-slate-600 text-[13px] line-clamp-2">{n.body}</div>}
                      <div className="text-slate-400 text-[12px] mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
