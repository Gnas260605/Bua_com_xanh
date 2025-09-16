// frontend/components/NotificationBell.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "../../lib/api";
import { Bell, X, Megaphone, Info, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";

/* ================= Constants ================= */
const LS_LAST_SEEN = "announcements_last_seen_at";
const LS_HIDDEN_IDS = "announcements_hidden_ids";
const LS_TIP_CLOSED = "announcements_tip_closed";
const ENABLE_SERVER_READ_API = false;

/* ================= Utils ================= */
function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - (d.getTime() || 0));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}
function normalizeItem(raw) {
  const it = { ...raw };
  const id = it.id ?? it.ann_id ?? it.key ?? Math.random().toString(36).slice(2);
  const title = it.title ?? it.name ?? "Thông báo";
  const body = it.body ?? it.content ?? it.message ?? "";
  const created_at = it.created_at ?? it.time ?? it.date ?? it.updated_at ?? new Date().toISOString();
  const level = (it.level ?? it.tone ?? it.severity ?? "info").toString();
  const active = Number(it.active ?? it.enabled ?? 1) === 1;
  const url = it.url ?? it.link ?? "";
  return { id, title, body, created_at, level, active, url };
}
function latestTs(list) {
  return list.reduce((mx, it) => {
    const t = new Date(it.created_at).getTime();
    return Number.isFinite(t) ? Math.max(mx, t) : mx;
  }, 0);
}
function loadHiddenIds() {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_IDS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function saveHiddenIds(set) {
  try { localStorage.setItem(LS_HIDDEN_IDS, JSON.stringify(Array.from(set))); } catch {}
}

/* ================= Modal (Portal) ================= */
function AnnouncementModal({ open, onClose, item }) {
  if (!open || !item) return null;

  const tone = (() => {
    const t = (item.level || "").toLowerCase();
    if (t.includes("danger") || t.includes("error") || t === "rose") return "rose";
    if (t.includes("warn") || t === "amber") return "amber";
    if (t.includes("success") || t === "emerald") return "emerald";
    return "sky";
  })();

  const styles = {
    bg: {
      sky: "from-sky-50 to-cyan-50 border-sky-200",
      emerald: "from-emerald-50 to-green-50 border-emerald-200",
      amber: "from-amber-50 to-yellow-50 border-amber-200",
      rose: "from-rose-50 to-pink-50 border-rose-200",
    }[tone],
    text: {
      sky: "text-sky-900",
      emerald: "text-emerald-900",
      amber: "text-amber-900",
      rose: "text-rose-900",
    }[tone],
    chip: {
      sky: "bg-sky-100 text-sky-900 border-sky-200",
      emerald: "bg-emerald-100 text-emerald-900 border-emerald-200",
      amber: "bg-amber-100 text-amber-900 border-amber-200",
      rose: "bg-rose-100 text-rose-900 border-rose-200",
    }[tone],
  };

  const modalEl = (
    <div className="fixed inset-0 z-[70]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 opacity-100 transition-opacity" onClick={onClose} />
      {/* dialog */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-[min(760px,95vw)] max-h-[85vh] rounded-2xl overflow-hidden bg-white shadow-2xl ring-1 ring-slate-900/5 transform transition-all"
        >
          {/* Header */}
          <div className={`p-5 border-b bg-gradient-to-br ${styles.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`inline-flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
                  <span className={`px-2 py-0.5 rounded-lg border ${styles.chip} inline-flex items-center gap-1`}>
                    <Megaphone size={14} /> {item.level || "info"}
                  </span>
                  <span className="text-slate-700">
                    • {new Date(item.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-900">
                  {item.title}
                </h3>
              </div>
              <button
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto">
            {/<[a-z][\s\S]*>/i.test(item.body || "") ? (
              <div
                className="prose prose-slate max-w-none prose-p:my-3 prose-headings:font-semibold prose-a:text-emerald-700"
                dangerouslySetInnerHTML={{ __html: item.body }}
              />
            ) : (
              <div className="text-[15.5px] leading-relaxed text-slate-900 whitespace-pre-wrap">
                {item.body || "—"}
              </div>
            )}

            {item.url && (
              <div className="pt-4">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold hover:from-emerald-500 hover:to-teal-500"
                >
                  Mở liên kết <ExternalLink size={16} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalEl, document.body);
}

/* ================= Main ================= */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [hiddenIds, setHiddenIds] = useState(loadHiddenIds());
  const [tipClosed, setTipClosed] = useState(localStorage.getItem(LS_TIP_CLOSED) === "1");

  const ref = useRef(null);

  // Close when click outside / ESC
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  // Polling
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const list = await fetchAnnouncements();
        if (!mounted) return;
        setItems(list);
        if (!localStorage.getItem(LS_LAST_SEEN)) localStorage.setItem(LS_LAST_SEEN, "0");
      } catch {}
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((n) => !hiddenIds.has(String(n.id))),
    [items, hiddenIds]
  );
  const unread = useMemo(() => {
    const lastSeen = Number(localStorage.getItem(LS_LAST_SEEN) || 0);
    return visibleItems.filter((n) => new Date(n.created_at).getTime() > lastSeen).length;
  }, [visibleItems]);

  async function fetchAnnouncements() {
    try {
      const res = await apiGet("/api/announcements?active=1&limit=20&order=desc");
      const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      return rows.map(normalizeItem);
    } catch {}
    try {
      const res = await apiGet("/api/announcements");
      const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      return rows.map(normalizeItem);
    } catch {}
    try {
      const res = await apiGet("/api/site-settings?key=announcements");
      const rows = Array.isArray(res?.value) ? res.value : Array.isArray(res?.items) ? res.items : [];
      return rows.map(normalizeItem);
    } catch {}
    return [];
  }

  const markAllRead = async () => {
    const ts = latestTs(visibleItems);
    localStorage.setItem(LS_LAST_SEEN, String(ts || Date.now()));
    if (ENABLE_SERVER_READ_API) { try { await apiPost("/api/announcements/mark-read", { all: true }); } catch {} }
  };

  const openOne = async (n) => {
    let detail = n;
    try {
      const resp = await apiGet(`/api/announcements/${encodeURIComponent(n.id)}`);
      if (resp?.item) detail = normalizeItem(resp.item);
    } catch {}
    setSelected(detail);
    setDetailOpen(true);

    const t = new Date(detail.created_at).getTime();
    const lastSeen = Number(localStorage.getItem(LS_LAST_SEEN) || 0);
    if (Number.isFinite(t) && t > lastSeen) localStorage.setItem(LS_LAST_SEEN, String(t));
    if (ENABLE_SERVER_READ_API) { try { await apiPost("/api/announcements/mark-read", { id: detail.id }); } catch {} }
  };

  const dismissOne = (id) => {
    const s = new Set(hiddenIds);
    s.add(String(id));
    setHiddenIds(s);
    saveHiddenIds(s);
  };
  const restoreAll = () => { const s = new Set(); setHiddenIds(s); saveHiddenIds(s); };
  const closeTip = () => { setTipClosed(true); localStorage.setItem(LS_TIP_CLOSED, "1"); };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        className="relative inline-grid place-items-center w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
        title="Thông báo"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} className="text-slate-700" />
        {unread > 0 && (
          <>
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] leading-[18px] text-center">
              {unread > 99 ? "99+" : unread}
            </span>
            {/* ping effect */}
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            </span>
          </>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-[460px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden origin-top-right"
        >
          {/* Arrow */}
          <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 bg-white border-l border-t border-slate-200" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="font-semibold text-slate-900">Thông báo</div>
            <div className="flex items-center gap-2">
              {hiddenIds.size > 0 && (
                <button
                  className="text-xs px-2 py-1 rounded-lg border bg-white hover:bg-slate-50 text-slate-700"
                  onClick={restoreAll}
                  title="Hiện lại các thông báo đã tắt"
                >
                  Khôi phục
                </button>
              )}
              <button
                className="text-sm text-emerald-700 hover:underline disabled:opacity-50"
                onClick={markAllRead}
                disabled={unread === 0}
              >
                Đánh dấu đã đọc
              </button>
            </div>
          </div>

          {/* Tip (dismissable) */}
          {!tipClosed && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-sky-50/70 flex items-start gap-3">
              <Info size={16} className="mt-0.5 text-sky-700" />
              <div className="text-[13.5px] text-sky-900">
                Bấm vào từng thông báo để xem chi tiết. Có thể <b>tắt</b> một thông báo bằng nút <span className="inline-flex items-center border rounded-md px-1.5 py-0.5 bg-white text-slate-700"><X size={12} className="mr-1" />X</span>.
              </div>
              <button className="ml-auto text-slate-600 hover:text-slate-900" onClick={closeTip} aria-label="Đóng lưu ý">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Body */}
          {err && <div className="p-4 text-rose-600 text-sm">{err}</div>}

          {!err && (
            <ul className="max-h-[520px] overflow-auto divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="p-4">
                  <div className="flex items-start gap-3 animate-pulse">
                    <div className="h-9 w-9 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-5/6" />
                    </div>
                  </div>
                </li>
              ))}

              {!loading && visibleItems.length === 0 && (
                <li className="p-6 text-center text-slate-500 text-sm">Chưa có thông báo.</li>
              )}

              {!loading && visibleItems.map((n) => {
                const isUnread = new Date(n.created_at).getTime() >
                  Number(localStorage.getItem(LS_LAST_SEEN) || 0);

                const Icon = (n.level || "").toLowerCase().includes("warn")
                  ? AlertTriangle
                  : (n.level || "").toLowerCase().includes("success")
                  ? CheckCircle2
                  : Megaphone;

                return (
                  <li key={n.id} className={`px-4 py-3 cursor-pointer group transition ${isUnread ? "bg-emerald-50/60 hover:bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start gap-3" onClick={() => openOne(n)}>
                      <div className="relative shrink-0 h-9 w-9 rounded-full border border-slate-200 bg-white grid place-items-center">
                        <Icon size={18} className={Icon === AlertTriangle ? "text-amber-600" : Icon === CheckCircle2 ? "text-emerald-600" : "text-sky-600"} />
                        {isUnread && <span className="absolute -right-0 -top-0 h-2 w-2 rounded-full bg-emerald-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-[15.5px] text-slate-900 truncate">{n.title || "Thông báo"}</div>
                            {n.body && <div className="text-slate-700 text-[13.5px] line-clamp-2">{n.body}</div>}
                            <div className="text-slate-400 text-[12px] mt-1">{timeAgo(n.created_at)}</div>
                          </div>
                          {/* Dismiss */}
                          <button
                            className="opacity-0 group-hover:opacity-100 transition rounded-md border border-slate-200 hover:bg-white p-1 text-slate-600"
                            onClick={(e) => { e.stopPropagation(); dismissOne(n.id); }}
                            title="Tắt thông báo này"
                            aria-label="Tắt thông báo"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Detail modal (portal) */}
      <AnnouncementModal open={detailOpen} onClose={() => setDetailOpen(false)} item={selected} />
    </div>
  );
}
