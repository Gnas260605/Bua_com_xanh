import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-gray-50">
      <aside className="border-r bg-white">
        <div className="p-4 font-bold text-emerald-700">Admin</div>
        <nav className="px-2 space-y-1">
          <Item to="/admin">Dashboard</Item>
          <Item to="/admin/users">Users</Item>
          <Item to="/admin/foods">Foods</Item>
          <Item to="/admin/campaigns">Campaigns</Item>
          <Item to="/admin/payments">Payments</Item>
          <Item to="/admin/settings">Settings</Item>
          <Item to="/admin/announcements">Announcements</Item>
        </nav>
      </aside>
      <main className="p-6">
        <Outlet/>
      </main>
    </div>
  );
}

function Item({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({isActive}) =>
        "block px-3 py-2 rounded-md " +
        (isActive ? "bg-emerald-100 text-emerald-800" : "hover:bg-gray-100")
      }
    >
      {children}
    </NavLink>
  );
}
