import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./components/layout/Layout";

// Pages (có thể đổi sang React.lazy nếu muốn tách bundle)
import Overview from "./pages/Overview";
import Campaigns from "./pages/Campaigns";
import Donors from "./pages/Donors";
import Recipients from "./pages/Recipients";
import Shippers from "./pages/Shippers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";

import { useAuth } from "./auth/AuthContext";

/** Loader nhỏ gọn khi lazy/Suspense */
function Loader() {
  return (
    <div className="w-full py-16 flex items-center justify-center text-slate-500">
      Đang tải...
    </div>
  );
}

/** Cuộn lên đầu khi đổi route */
function ScrollToTop() {
  const location = useLocation();
  React.useEffect(() => {
    // dùng instant để tránh hiệu ứng giật
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

/** ErrorBoundary đơn giản cho các lỗi runtime trong cây con */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || "Đã xảy ra lỗi." };
  }
  componentDidCatch(error, info) {
    // Có thể log ra Sentry/Console
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

/** Route bảo vệ: nếu chưa login thì điều hướng tới /login và nhớ `from` */
function Protected({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/** Chỉ cho khách (chưa login) vào các trang login/register/forgot */
function PublicOnly({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    const backTo = location.state?.from?.pathname || "/";
    return <Navigate to={backTo} replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Public routes */}
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

            {/* Protected layout + nested routes */}
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              {/* "/" == Overview */}
              <Route index element={<Overview />} />

              {/* Các trang con */}
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="donors" element={<Donors />} />
              <Route path="recipients" element={<Recipients />} />
              <Route path="shippers" element={<Shippers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* 404 → về trang chủ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
