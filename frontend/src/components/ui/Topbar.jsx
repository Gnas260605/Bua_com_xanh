import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useEffect, useRef, useState } from "react";
import { useLayout } from "../layout/LayoutState.jsx";
import NotificationBell from "../ui/NotificationBell.jsx";

function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] || "").toUpperCase() + (p[1]?.[0] || "").toUpperCase();
}

export default function Topbar() {
  const { sidebarWidth } = useLayout();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header
      style={{ ["--sbw"]: `${sidebarWidth}px` }}
      className={[
        "sticky top-0 z-40 w-full",
        "bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500",
        "supports-[backdrop-filter]:backdrop-blur",
        "border-b border-white/20 shadow-[0_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(16,24,40,0.15)]",
        // full width + né sidebar bằng padding-left
        "md:pl-[var(--sbw)]",
      ].join(" ")}
      role="banner"
    >
      <div className="h-16 px-3 sm:px-4 flex items-center gap-3 text-white">
        {/* Logo + brand */}
        <Link
          to="/"
          className="group flex items-center gap-2 font-bold text-white text-base sm:text-lg tracking-wide focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 rounded-xl"
          aria-label="Về trang chủ Bữa Cơm Xanh"
        >
          <span className="w-8 h-8 rounded-lg bg-white/20 grid place-items-center shadow-sm transition-transform group-hover:scale-105">
            B
          </span>
          <span className="leading-none drop-shadow hidden xs:inline">Bữa Cơm Xanh</span>
        </Link>

        {/* Tìm kiếm chiếm toàn bộ khoảng trống giữa */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-lg">
            <input
              className={[
                "w-full h-11 rounded-xl",
                "bg-white/15 text-white placeholder-white/70",
                "pl-11 pr-20",
                "outline-none border border-white/20",
                "focus:border-white/40 focus:ring-4 focus:ring-white/20",
                "backdrop-blur-md",
              ].join(" ")}
              placeholder="Tìm kiếm chiến dịch, người dùng…"
              aria-label="Tìm kiếm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none opacity-90">🔎</span>
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/25 bg-white/10 px-2 py-0.5 text-xs tracking-wide"
              aria-hidden
            >
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* 🔔 + Avatar sát phải */}
        <div className="flex items-center gap-2 ml-2">
          <NotificationBell />

          <div className="relative" ref={ref}>
            <button
              className={[
                "w-10 h-10 rounded-full overflow-hidden grid place-items-center",
                "border border-white/30 bg-white/10",
                "shadow-inner transition hover:bg-white/15",
                "focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30",
              ].join(" ")}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Mở menu tài khoản"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold">{initials(user?.name || user?.email || "U S")}</span>
              )}
            </button>

            {open && (
              <div
                className={[
                  "absolute right-0 mt-3 w-72 origin-top-right",
                  "rounded-2xl border border-slate-200 bg-white text-slate-900",
                  "shadow-[0_8px_24px_rgba(16,24,40,0.16)] p-2",
                  "animate-[fadeIn_.12s_ease-out]",
                ].join(" ")}
                role="menu"
              >
                <div className="px-3 py-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full grid place-items-center bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-sm font-semibold">{initials(user?.name || user?.email || "U S")}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{user?.name || "Người dùng"}</div>
                    <div className="text-slate-500 text-sm truncate">{user?.email}</div>
                  </div>
                </div>

                <div className="my-1 h-px bg-slate-100" />

                <Link
                  className="block px-3 py-2 rounded-xl hover:bg-slate-50 transition text-slate-700"
                  to="/settings"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  ⚙️ Cài đặt
                </Link>
                <Link
                  className="block px-3 py-2 rounded-xl hover:bg-slate-50 transition text-slate-700"
                  to="/campaigns"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  🎯 Chiến dịch
                </Link>

                <div className="mt-1 p-1">
                  <button
                    className={[
                      "w-full px-3 py-2 rounded-xl",
                      "bg-rose-600 text-white font-medium",
                      "hover:bg-rose-700 active:translate-y-[1px]",
                      "shadow-[0_2px_0_rgba(0,0,0,0.08)]",
                      "focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300",
                    ].join(" ")}
                    onClick={signOut}
                    role="menuitem"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
