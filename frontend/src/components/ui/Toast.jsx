import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

/* ================== Utils ================== */
const genId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const ICONS = {
  success: "✅",
  error: "⛔",
  info: "ℹ️",
  warn: "⚠️",
};

/* Chủ đề màu cho “big toast” */
const THEMES = {
  success: {
    ring: "ring-emerald-300/80",
    bar: "from-emerald-500 to-teal-500",
    icon: "text-emerald-600",
    chipBg: "bg-emerald-50 text-emerald-700",
  },
  error: {
    ring: "ring-rose-300/80",
    bar: "from-rose-500 to-pink-500",
    icon: "text-rose-600",
    chipBg: "bg-rose-50 text-rose-700",
  },
  info: {
    ring: "ring-sky-300/80",
    bar: "from-sky-500 to-cyan-500",
    icon: "text-sky-600",
    chipBg: "bg-sky-50 text-sky-700",
  },
  warn: {
    ring: "ring-amber-300/80",
    bar: "from-amber-500 to-orange-500",
    icon: "text-amber-600",
    chipBg: "bg-amber-50 text-amber-800",
  },
};

/* ================== Context / hook ================== */
const ToastCtx = createContext(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ================== Provider ================== */
export function ToastProvider({ children, max = 3, defaultDuration = 3500 }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, payload, opts = {}) => {
      const { title, description } =
        typeof payload === "string" ? { title: payload, description: "" } : payload || {};

      const id = genId();
      const duration = Number.isFinite(opts.duration) ? opts.duration : defaultDuration;

      setItems((prev) => {
        const next = [...prev, { id, type, title, description, duration, createdAt: Date.now() }];
        if (next.length > max) next.shift(); // giới hạn hàng đợi
        return next;
      });
      return id;
    },
    [defaultDuration, max]
  );

  const api = useMemo(
    () => ({
      show: (o) => show(o.type || "info", o, o),
      success: (msg, o) => show("success", msg, o),
      error: (msg, o) => show("error", msg, o),
      info: (msg, o) => show("info", msg, o),
      warn: (msg, o) => show("warn", msg, o),
      dismiss: (id) => remove(id),
      dismissAll: () => setItems([]),
    }),
    [remove, show]
  );

  // ESC đóng toast hiện tại
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && items.length) {
        const last = items[items.length - 1];
        remove(last.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, remove]);

  // Chỉ hiển thị TOAST MỚI NHẤT ở giữa màn hình (các cái trước đó chờ trong hàng)
  const current = items[items.length - 1] || null;

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* ===== Overlay + Big toast (center) ===== */}
      {current && (
        <BigToastOverlay
          key={current.id}
          toast={current}
          onClose={() => remove(current.id)}
        />
      )}
    </ToastCtx.Provider>
  );
}

/* ================== Big Toast Overlay ================== */
function BigToastOverlay({ toast, onClose }) {
  const { id, type = "info", title = "", description = "", duration = 3500 } = toast;
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const startedAtRef = useRef(Date.now());
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  const theme = THEMES[type] || THEMES.info;

  // mount animation
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // auto-dismiss + progress
  useEffect(() => {
    if (duration <= 0) return; // không tự tắt
    startTimer(remaining);

    function step() {
      const elapsed = Date.now() - startedAtRef.current;
      setRemaining(Math.max(0, duration - elapsed));
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, duration]);

  const startTimer = (ms) => {
    clearTimeout(timerRef.current);
    startedAtRef.current = Date.now() - (duration - ms);
    timerRef.current = setTimeout(() => handleClose(), ms);
  };

  const pause = () => { clearTimeout(timerRef.current); cancelAnimationFrame(rafRef.current); };
  const resume = () => {
    if (duration <= 0) return;
    startTimer(remaining);
    rafRef.current = requestAnimationFrame(function step() {
      const elapsed = Date.now() - startedAtRef.current;
      setRemaining(Math.max(0, duration - elapsed));
      rafRef.current = requestAnimationFrame(step);
    });
  };

  const handleClose = () => {
    setLeaving(true);
    setTimeout(onClose, 180);
  };

  const barPct = duration ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center",
        // overlay mờ + blur nền
        mounted && !leaving ? "bg-slate-950/50 backdrop-blur-[2px]" : "bg-slate-950/0",
        "transition-colors duration-200",
      ].join(" ")}
      onClick={handleClose}
      aria-hidden
    >
      {/* Card lớn (ngăn click xuyên) */}
      <div
        role="alert"
        aria-live="polite"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onClick={(e) => e.stopPropagation()}
        className={[
          "w-[min(720px,92vw)] max-w-[92vw]",
          "rounded-3xl bg-white text-slate-900 shadow-2xl",
          "p-7 md:p-9 ring-1",
          theme.ring,
          "transition-all duration-200",
          mounted && !leaving ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2",
        ].join(" ")}
      >
        {/* Thanh accent trên đầu */}
        <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${theme.bar} mb-5`} />

        <div className="flex items-start gap-4">
          <div
            className={[
              "grid place-items-center shrink-0 h-14 w-14 rounded-2xl ring-1",
              theme.ring, theme.chipBg, theme.icon,
              "text-3xl",
            ].join(" ")}
            aria-hidden
          >
            {ICONS[type] || ICONS.info}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold leading-tight">{title || "Thông báo"}</h3>
            {description ? (
              <p className="mt-1.5 text-base leading-relaxed text-slate-700">{description}</p>
            ) : null}
          </div>

          <button
            onClick={handleClose}
            className="ml-2 -mr-1 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Đóng thông báo"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Progress bar to đùng */}
        {duration > 0 && (
          <div className="mt-6 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-[width] duration-100`}
              style={{ width: `${barPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
