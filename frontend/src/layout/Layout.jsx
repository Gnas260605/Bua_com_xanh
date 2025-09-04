import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar.jsx";
import Topbar from "../Topbar.jsx";

export default function Layout() {
  return (
    <div className="min-h-screen bg-app">
      <Topbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        <aside className="w-[280px] shrink-0">
          <Sidebar />
        </aside>
        <main className="flex-1">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
}
