// src/components/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "../ui/Sidebar.jsx";
import Topbar from "../ui/Topbar.jsx";
import { LayoutProvider } from "./LayoutState.jsx";

export default function Layout() {
  return (
    <LayoutProvider>
      <div className="h-screen flex bg-app text-slate-800 dark:text-slate-100 overflow-hidden">
        {/* Sidebar cố định */}
        <aside className="flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Cột phải */}
        <div className="flex-1 flex min-w-0 flex-col">
          {/* Topbar sticky */}
          <header className="sticky top-0 z-40 border-b border-slate-200/60 dark:border-slate-700/50 bg-app/80 backdrop-blur supports-[backdrop-filter]:bg-app/60">
            <Topbar />
          </header>

          {/* Content scroll chính */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="w-full p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
}
