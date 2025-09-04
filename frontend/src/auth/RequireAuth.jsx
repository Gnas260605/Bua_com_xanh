import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function RequireAuth() {
  const { user, booted } = useAuth();
  const loc = useLocation();

  if (!booted) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">
        Đang tải
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <Outlet />;
}
