import { NavLink } from "react-router-dom";
import { useLayout } from "../layout/LayoutState.jsx";
import {
  Home, Target, Heart, Users, Truck, BarChart3, Settings,
  HandHeart, Package, Route, ChevronLeft, Menu
} from "lucide-react";

/* Danh sách nav item */
const navs = [
  { to: "/",          icon: Home,      label: "Tổng quan",   color: "text-emerald-400" },
  { to: "/campaigns", icon: Target,    label: "Chiến dịch",  color: "text-sky-400" },
  { to: "/donors",    icon: Heart,     label: "Nhà hảo tâm", color: "text-rose-400" },
  { to: "/recipients",icon: Users,     label: "Người nhận",  color: "text-indigo-400" },
  { to: "/shippers",  icon: Truck,     label: "Shipper TNV", color: "text-amber-400" },
  { to: "/donate",    icon: HandHeart, label: "Quyên góp",   color: "text-fuchsia-400" },
  { to: "/delivery",  icon: Package,   label: "Giao nhận",   color: "text-cyan-400" },
  { to: "/reports",   icon: BarChart3, label: "Báo cáo",     color: "text-teal-400" },
  { to: "/settings",  icon: Settings,  label: "Cài đặt",     color: "text-slate-300" },
];

export default function Sidebar() {
  const { collapsed, toggleSidebar } = useLayout();

  return (
    <aside
      className={[
        "hidden md:flex flex-col shrink-0",
        "sticky top-0 h-screen z-50",
        "border-r border-slate-800",
        "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-slate-200",
        "transition-[width] duration-300",
        collapsed ? "w-[80px]" : "w-[264px]"
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-800">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img
              src="/images/logo.jpg"
              alt="Logo"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="text-xl font-bold leading-none tracking-wide">
              Bữa Cơm Xanh
            </span>
          </div>
        ) : (
          <img
            src="/images/logo.png"
            alt="Logo"
            className="h-9 w-9 mx-auto rounded-lg object-contain"
          />
        )}

        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-slate-800 transition"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <Menu size={20}/> : <ChevronLeft size={20}/>}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {navs.map(({ to, icon: Icon, label, color }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    "group relative flex items-center rounded-xl h-12 px-3",
                    "text-[15px] font-medium transition-colors",
                    isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  ].join(" ")
                }
                title={collapsed ? label : undefined}
              >
                {/* Thanh highlight bên trái khi active */}
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r bg-emerald-400 opacity-0 group-[.active]:opacity-100" />

                {/* Icon */}
                <Icon
                  size={20}
                  className={[
                    "shrink-0 mr-3 transition-colors",
                    color,
                    collapsed ? "mx-auto mr-0" : ""
                  ].join(" ")}
                />

                {/* Label */}
                {!collapsed && <span className="truncate leading-none">{label}</span>}

                {/* Tooltip khi collapsed */}
                {collapsed && (
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded bg-slate-800 text-xs font-medium text-slate-100 opacity-0 group-hover:opacity-100 pointer-events-none shadow">
                    {label}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={[
          "mt-auto px-3 py-4 border-t border-slate-800 text-sm text-slate-500",
          collapsed && "text-center"
        ].join(" ")}
      >
        v0.2 • UI refresh
      </div>
    </aside>
  );
}
