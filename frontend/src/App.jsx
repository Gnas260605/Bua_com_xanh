import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./components/layout/Layout";

// App pages
import Overview from "./pages/Overview";
import Campaigns from "./pages/Campaigns";
import Donors from "./pages/Donors";
import Recipients from "./pages/Recipients";
import Shippers from "./pages/Shippers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";

// Admin
import RequireAdmin from "./auth/RequireAdmin";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminUsers from "./admin/AdminUsers";
import AdminPlaceholder from "./admin/AdminPlaceholder";

import { useAuth } from "./auth/AuthContext";

/* ---------- Small utilities ---------- */

function Loader() {
  return (
    <div className="w-full py-16 flex items-center justify-center text-slate-500">
      Đang tải...
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || "Đã xảy ra lỗi." };
  }
  componentDidCatch(error, info) {
    console.error("App ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-6 rounded-xl border bg-white shadow-sm text-red-600">
          <div className="font-semibold mb-1">Đã xảy ra lỗi khi hiển thị trang.</div>
          <div className="text-sm">{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Route guards ---------- */

function Protected({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    const backTo = location.state?.from?.pathname || "/";
    return <Navigate to={backTo} replace />;
  }
  return children;
}

/* ---------- App Routes ---------- */

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Public (guest-only) */}
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnly>
                  <Register />
                </PublicOnly>
              }
            />
            <Route
              path="/forgot"
              element={
                <PublicOnly>
                  <ForgotPassword />
                </PublicOnly>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicOnly>
                  <VerifyOtp />
                </PublicOnly>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicOnly>
                  <ResetPassword />
                </PublicOnly>
              }
            />

            {/* Protected user area */}
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Overview />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="donors" element={<Donors />} />
              <Route path="recipients" element={<Recipients />} />
              <Route path="shippers" element={<Shippers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Admin area (requires login + admin role) */}
            <Route
              path="/admin"
              element={
                <Protected>
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                </Protected>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="foods" element={<AdminPlaceholder title="Foods Moderation" />} />
              <Route path="campaigns" element={<AdminPlaceholder title="Campaigns" />} />
              <Route path="payments" element={<AdminPlaceholder title="Payments" />} />
              <Route path="settings" element={<AdminPlaceholder title="Site Settings" />} />
              <Route path="announcements" element={<AdminPlaceholder title="Announcements" />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
