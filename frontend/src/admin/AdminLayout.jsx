// src/admin/AdminLayout.jsx
// TailwindCSS + lucide-react + react-router-dom

import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Utensils,
  CalendarCheck2,
  Truck,
  Megaphone,
  Layers,
  FileText,
  Landmark,
  Bell,
  ScrollText,
  Settings,
  ChevronRight,
  Menu,
  X,
  Leaf,
  Search,
  ChevronDown,
  LogOut,
  SunMedium,
  MoonStar,
} from "lucide-react";

/* =============================
   Menu config
============================= */
const MENU = [
  {
    label: "Trang chính",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Quản trị",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/foods", label: "Foods", icon: Utensils },
      { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck2 },
      { to: "/admin/deliveries", label: "Deliveries", icon: Truck },
    ],
  },
  {
    label: "Chiến dịch & CMS",
    items: [
      { to: "/admin/campaigns", label: "Campaigns", icon: Layers },
      { to: "/admin/pickup-points", label: "Pickup points", icon: Landmark },
      { to: "/admin/pages", label: "CMS Pages", icon: FileText },
    ],
  },
  {
    label: "Tài chính & Hệ thống",
    items: [
      { to: "/admin/payments", label: "Payments", icon: Landmark },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout() {
  const loc = useLocation();
  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("admin.sidebar.collapsed") === "1"; } catch { return false; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("theme") || "system"; } catch { return "system"; }
  });
  const [query, setQuery] = useState("");

  // Sidebar width (desktop)
  const SBW = collapsed ? 88 : 280;

  // Close mobile sidebar on route change
  useEffect(() => { setOpenMobile(false); }, [loc.pathname]);

  // Persist collapse
  useEffect(() => { try { localStorage.setItem("admin.sidebar.collapsed", collapsed ? "1" : "0"); } catch {} }, [collapsed]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && sysDark);
    root.classList.toggle("dark", isDark);
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  // Search filter
  const filteredMenu = useMemo(() => {
    if (!query.trim()) return MENU;
    const q = query.toLowerCase();
    return MENU.map(sec => ({ ...sec, items: sec.items.filter(i => i.label.toLowerCase().includes(q)) }))
               .filter(sec => sec.items.length);
  }, [query]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.getAttribute("contenteditable") === "true");
      if (typing) return;
      if (e.key === "/" || (e.ctrlKey && (e.key === "k" || e.key === "K"))) {
        const el = document.querySelector('input[data-admin-search="1"]');
        if (el) { e.preventDefault(); el.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-black relative">
      {/* Decorative neon glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute right-[-10%] top-20 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute left-1/3 bottom-[-10%] h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      {/* ===== Topbar (full width, flush left) ===== */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-emerald-100/70 dark:border-emerald-900/40
                   backdrop-blur supports-[backdrop-filter]:bg-white/65 dark:supports-[backdrop-filter]:bg-black/30
                   shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_20px_60px_-20px_rgba(16,185,129,0.35)]">
        <div className="h-14 flex items-center gap-2 px-3 sm:px-4">
          {/* Mobile menu */}
          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
            onClick={() => setOpenMobile(v => !v)}
            aria-label="Toggle sidebar"
          >
            {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-2xl
                             bg-gradient-to-br from-emerald-500 to-teal-600 text-white
                             shadow-[0_0_0_2px_rgba(255,255,255,0.6)_inset,0_8px_30px_-8px_rgba(16,185,129,0.6)]">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="hidden sm:block">Bữa Cơm Xanh • Admin</span>
          </div>

          {/* Search (desktop) */}
          <div className="hidden md:flex ml-4 flex-1 max-w-2xl">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                data-admin-search="1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm nhanh… (/, Ctrl+K)"
                className="w-full h-10 rounded-xl pl-9 pr-3 text-sm
                           bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-900
                           shadow-[0_1px_0_0_rgba(0,0,0,0.02)]
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeSwitcher theme={theme} setTheme={setTheme} />
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4">3</span>
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ===== Sidebar (desktop, fixed & flush-left) ===== */}
      <aside
        className="hidden md:block fixed top-14 left-0 z-40 h-[calc(100vh-56px)]
                   bg-white/80 dark:bg-slate-950/50 backdrop-blur
                   border-r border-emerald-100/70 dark:border-emerald-900/40
                   shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_30px_80px_-30px_rgba(16,185,129,0.45)]
                   transition-[width] duration-300"
        style={{ width: SBW }}
      >
        <div className="h-full flex flex-col">
          {/* Collapse toggle */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={() => setCollapsed(v => !v)}
              className="w-full text-left text-[11px] uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-between"
            >
              <span>{collapsed ? "Mở rộng" : "Thu gọn"}</span>
              <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-90"}`} />
            </button>
          </div>

          {/* Search (sidebar) */}
          <div className="px-3 pb-2">
            {collapsed ? (
              <div className="group relative flex items-center justify-center">
                <div className="h-10 w-10 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Search className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </div>
                <span className="pointer-events-none absolute left-12 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Ctrl+K</span>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  data-admin-search="1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm trong menu…"
                  className="w-full h-10 rounded-xl pl-9 pr-3 text-sm
                             bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                />
              </div>
            )}
          </div>

          {/* Menu */}
          <nav className="px-2 flex-1 overflow-y-auto">
            {filteredMenu.map((sec) => (
              <SidebarSection key={sec.label} label={sec.label} collapsed={collapsed}>
                {sec.items.map((it) => (
                  <SidebarItem key={it.to} to={it.to} icon={it.icon} exact={it.exact} collapsed={collapsed}>
                    {it.label}
                  </SidebarItem>
                ))}
              </SidebarSection>
            ))}
          </nav>

          {/* Footer helper */}
          <div className="p-3 border-t border-emerald-100/70 dark:border-emerald-900/40">
            <div className={`rounded-xl ${collapsed ? "p-2" : "p-3"} bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200/60 dark:border-emerald-900/40`}>
              {collapsed ? (
                <Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Bữa Cơm Xanh</div>
                  <div>Nhấn <kbd className="px-1 rounded border">/</kbd> hoặc <kbd className="px-1 rounded border">Ctrl+K</kbd> để tìm nhanh.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Mobile Drawer ===== */}
      {openMobile && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-white dark:bg-slate-950 border-r border-emerald-100 dark:border-emerald-900 shadow-2xl">
            <div className="h-14 flex items-center px-3">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <Leaf className="h-4 w-4" />
                </span>
                <span>Admin</span>
              </div>
              <button className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30" onClick={() => setOpenMobile(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  data-admin-search="1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm trong menu…"
                  className="w-full h-10 rounded-xl pl-9 pr-3 text-sm bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                />
              </div>
            </div>
            <nav className="px-2 pb-8 overflow-y-auto max-h-[calc(100vh-56px-56px)]">
              {filteredMenu.map((sec) => (
                <SidebarSection key={sec.label} label={sec.label} collapsed={false}>
                  {sec.items.map((it) => (
                    <SidebarItem key={it.to} to={it.to} icon={it.icon} exact={it.exact} collapsed={false}>
                      {it.label}
                    </SidebarItem>
                  ))}
                </SidebarSection>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ===== Content ===== */}
      <main
        className="pt-14"
        // push content to the right of the fixed sidebar on md+
        style={{ marginLeft: undefined }}
      >
        <div className="md:pl-0" style={{ paddingLeft: 0 }}>
          <div className="px-3 sm:px-4 md:px-6" style={{ marginLeft: 0, marginRight: 0 }}>
            <div
              className="rounded-2xl border border-emerald-100/80 dark:border-emerald-900/50
                         bg-white/70 dark:bg-slate-950/40 backdrop-blur
                         shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_30px_100px_-40px_rgba(16,185,129,0.55)]"
              // align with sidebar width on md+
              style={{ marginLeft: 0, marginRight: 0, paddingLeft: 0 }}
            >
              <div className="p-3 sm:p-4 md:p-6" style={{ paddingLeft: `min(2rem, 5vw)` }}>
                <div className="mx-auto w-full max-w-7xl">
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Adjust content & topbar padding-left for sidebar width on md+ */}
      <style>{`
        @media (min-width: 768px) {
          header { padding-left: ${SBW}px; }
          main   { margin-left: ${SBW}px; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Subcomponents ---------- */
function SidebarSection({ label, children, collapsed }) {
  return (
    <div className="mb-2">
      <div className={`px-3 pt-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 select-none ${collapsed ? "text-center" : ""}`}>
        {collapsed ? label.split(" ")[0] : label}
      </div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function SidebarItem({ to, children, icon: Icon = ChevronRight, exact = false, collapsed = false }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-xl transition outline-none",
          "focus-visible:ring-2 focus-visible:ring-emerald-300",
          collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
          isActive
            ? "text-emerald-900 dark:text-emerald-300 bg-gradient-to-r from-emerald-100/80 to-teal-100/60 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-200/70 dark:border-emerald-900/40 shadow-[0_6px_30px_-15px_rgba(16,185,129,0.65)]"
            : "text-slate-700 dark:text-slate-200 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20 border border-transparent hover:shadow-[0_8px_24px_-18px_rgba(16,185,129,0.45)]"
        ].join(" ")
      }
    >
      {/* Active neon ribbon */}
      <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 opacity-0 group-[.active]:opacity-100" />
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
      {!collapsed && <span className="flex-1 text-sm">{children}</span>}
    </NavLink>
  );
}

function ThemeSwitcher({ theme, setTheme }) {
  const next = () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
  return (
    <button
      onClick={next}
      className="inline-flex items-center gap-2 h-9 px-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm"
      title={`Theme: ${label}`}
    >
      <SunMedium className="h-5 w-5 hidden dark:inline" />
      <MoonStar className="h-5 w-5 dark:hidden" />
      <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300">{label}</span>
    </button>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e) => { if (!e.target.closest?.("#user-menu")) setOpen(false); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  return (
    <div id="user-menu" className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white text-xs font-semibold">NV</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-slate-900 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_30px_80px_-20px_rgba(16,185,129,0.45)] overflow-hidden">
          <div className="px-3 py-3 border-b border-emerald-100 dark:border-emerald-900">
            <div className="text-sm font-semibold">Người vận hành</div>
            <div className="text-xs text-slate-500">operator@greengive.local</div>
          </div>
          <div className="p-1">
            <MenuItem icon={Settings}>Cài đặt tài khoản</MenuItem>
            <MenuItem icon={ScrollText}>Nhật ký hoạt động</MenuItem>
          </div>
          <div className="p-1 border-t border-emerald-100 dark:border-emerald-900">
            <MenuItem icon={LogOut}>Đăng xuất</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, children }) {
  return (
    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm">
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}
