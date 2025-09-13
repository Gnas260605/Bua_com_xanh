// src/admin/AdminLayout.jsx
import { useEffect, useState } from "react";
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
} from "lucide-react";

export default function AdminLayout() {
  const [open, setOpen] = useState(false); // mobile sidebar
  const loc = useLocation();

  // auto-close sidebar khi điều hướng (mobile)
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== Topbar (mobile + desktop) ===== */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 font-semibold text-emerald-700">
            <Leaf className="h-5 w-5" />
            <span>Bữa Cơm Xanh • Admin</span>
          </div>

          <div className="ml-auto text-sm text-slate-500">
            {/* chỗ này bạn có thể hiển thị user hiện tại */}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* ===== Sidebar ===== */}
        <aside
          className={
            "bg-white border-r md:sticky md:top-[57px] md:h-[calc(100vh-57px)] " +
            (open ? "block" : "hidden md:block")
          }
        >
          <nav className="px-2 py-4 space-y-2">
            <Section>Trang chính</Section>
            <Item to="/admin" exact icon={LayoutDashboard}>
              Dashboard
            </Item>

            <Section>Quản trị</Section>
            <Item to="/admin/users" icon={Users}>Users</Item>
            <Item to="/admin/foods" icon={Utensils}>Foods</Item>
            <Item to="/admin/bookings" icon={CalendarCheck2}>Bookings</Item>
            <Item to="/admin/deliveries" icon={Truck}>Deliveries</Item>

            <Section>Chiến dịch &amp; CMS</Section>
            <Item to="/admin/campaigns" icon={Layers}>Campaigns</Item>
            <Item to="/admin/pickup-points" icon={Landmark}>Pickup points</Item>
            <Item to="/admin/pages" icon={FileText}>CMS Pages</Item>

            <Section>Tài chính &amp; Hệ thống</Section>
            <Item to="/admin/payments" icon={Landmark}>Payments</Item>
            <Item to="/admin/announcements" icon={Megaphone}>Announcements</Item>
            <Item to="/admin/audit" icon={ScrollText}>Audit logs</Item>
            <Item to="/admin/settings" icon={Settings}>Settings</Item>
          </nav>
        </aside>

        {/* ===== Content ===== */}
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Item({ to, children, icon: Icon = ChevronRight, exact = false }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        [
          "group flex items-center gap-2 px-3 py-2 rounded-lg transition",
          "outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
          isActive
            ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
            : "text-slate-700 hover:bg-slate-100",
        ].join(" ")
      }
    >
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
      <span className="flex-1">{children}</span>
    </NavLink>
  );
}

function Section({ children }) {
  return (
    <div className="px-3 pt-3 text-[11px] uppercase tracking-wide text-slate-500 select-none">
      {children}
    </div>
  );
}
