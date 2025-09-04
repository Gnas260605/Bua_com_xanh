import { NavLink } from "react-router-dom";

const Item = ({ to, icon, children }) => (
  <NavLink
    to={to}
    end={to === "/"} // chỉ áp dụng "end" cho route "/"
    className={({ isActive }) =>
      "flex items-center gap-3 rounded-xl px-3 py-3 transition " +
      (isActive ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-100")
    }
  >
    <span className="text-lg">{icon}</span>
    <span className="font-medium">{children}</span>
  </NavLink>
);

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] border-r border-slate-200 bg-white/95 backdrop-blur">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-emerald-600 text-white text-lg">
            🍱
          </div>
          <div className="text-lg font-semibold">Bữa Cơm Xanh</div>
        </div>
      </div>

      {/* Menu */}
      <nav className="px-3 space-y-2">
        <Item to="/" icon="🏠">Tổng quan</Item>
        <Item to="/campaigns" icon="🎯">Chiến dịch</Item>
        <Item to="/donors" icon="💝">Nhà tài trợ</Item>
        <Item to="/recipients" icon="🤲">Người nhận</Item>
        <Item to="/shippers" icon="🚚">Người giao</Item>
        <Item to="/reports" icon="📊">Báo cáo</Item>
        <Item to="/settings" icon="⚙️">Cài đặt</Item>
      </nav>

      {/* Footer */}
      <div className="absolute bottom-3 left-0 right-0 px-4 text-xs text-slate-500">
        v0.2 • UI refresh
      </div>
    </aside>
  );
}
