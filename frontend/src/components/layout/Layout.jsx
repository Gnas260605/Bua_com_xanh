import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 shrink-0 hidden md:block">
        <Sidebar />
      </aside>

      <main className="flex-1 min-w-0">
        <Topbar />
        <div className="p-6">
          {/* Nơi render các trang con */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
