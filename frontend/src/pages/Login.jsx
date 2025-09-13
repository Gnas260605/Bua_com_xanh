// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function Login() {
  const { register: rf, handleSubmit, formState, setError } = useForm({
    defaultValues: { email: "", password: "", remember: true },
  });
  const { errors } = formState;
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Preload background để chắc chắn thấy ảnh
  const [bgSrc, setBgSrc] = useState(BG_URL);
  const [bgReady, setBgReady] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgReady(true);
    img.onerror = () => { setBgSrc(BG_FALLBACK); setBgReady(true); };
    img.src = BG_URL;
  }, []);

  const onSubmit = async (v) => {
    setLoading(true);
    try {
      await signIn(v.email, v.password, v.remember);
      const to = loc.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch {
      setShakeKey((k) => k + 1);
      setError("password", { type: "manual", message: "Đăng nhập thất bại. Vui lòng kiểm tra lại." });
    } finally { setLoading(false); }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ===== Background ===== */}
      <div className="absolute inset-0 -z-20">
        <img
          src={bgSrc}
          alt=""
          className="h-full w-full object-cover"
          style={{ opacity: bgReady ? 1 : 0, transition: "opacity .6s ease" }}
        />
        <div className="absolute inset-0 bg-slate-950/45" aria-hidden />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(1100px 520px at 20% 10%, rgba(16,185,129,0.18), transparent 45%), radial-gradient(1100px 520px at 85% 10%, rgba(56,189,248,0.15), transparent 45%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.35)_100%)]" aria-hidden />
      </div>

      {/* spotlight sau card */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 pointer-events-none blur-3xl -z-10 w-[48rem] h-[48rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.32),rgba(255,255,255,0)_60%)]" />

      {/* ===== Content ===== */}
      <div className="relative z-10 flex min-h-screen items-center lg:justify-between">
        {/* Cột trái (60%) */}
        <motion.div
          className="hidden lg:flex basis-[60%] w-[60%] flex-col items-center justify-center px-12"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="max-w-2xl">
            <img src={LOGO_URL} alt="Logo" className="h-12 w-auto mb-6 drop-shadow-[0_2px_10px_rgba(16,185,129,0.35)]" />
            <h2 className="text-6xl font-extrabold tracking-tight leading-tight text-white">Chào mừng quay lại 👋</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-200/95 max-w-xl">
              Kết nối để quản lý chiến dịch, theo dõi quyên góp và vận hành hiệu quả hơn.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-[15px] max-w-md">
              {[
                ["Minh bạch", "ring-emerald-400/40 bg-emerald-400/10 text-emerald-200"],
                ["Nhanh chóng", "ring-sky-400/40 bg-sky-400/10 text-sky-200"],
                ["An toàn", "ring-violet-400/40 bg-violet-400/10 text-violet-200"],
              ].map(([t, cls]) => (
                <div key={t} className={`rounded-xl px-4 py-2 ring-1 ${cls} text-center`}>{t}</div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Cột phải: FORM 40% */}
        <div className="w-full px-6 lg:basis-[40%] lg:w-[40%] max-w-none">
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 130, damping: 16 }}
          >
            <Card
              className="
                relative overflow-hidden rounded-2xl
                border border-slate-200 bg-white/85 backdrop-blur-xl
                p-10 shadow-[0_10px_40px_rgba(0,0,0,0.35)]
                text-slate-900
              "
            >
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/50" />
              <span className="pointer-events-none absolute -inset-px rounded-2xl bg-[conic-gradient(at_20%_-10%,#22c55e18,transparent_25%,#38bdf818,transparent_60%,#a78bfa18)]" />

              <div className="flex items-center gap-3 mb-6">
                <img src={LOGO_URL} alt="Logo" className="h-9 w-auto" />
                <h1 className="text-3xl font-bold">Đăng nhập</h1>
              </div>
              <p className="text-base text-slate-700 mb-6">Sử dụng tài khoản đã đăng ký.</p>

              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <label className="text-[15px] font-medium text-slate-800">Email</label>
                  <div className="mt-1.5 relative">
                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input h-14 pl-12 rounded-xl text-[16px]"
                      type="email"
                      placeholder="you@example.com"
                      {...rf("email", { required: "Vui lòng nhập email" })}
                    />
                  </div>
                  <AnimatePresence>
                    {errors.email && (
                      <motion.p className="mt-1 text-sm text-rose-600" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        {errors.email.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="text-[15px] font-medium text-slate-800">Mật khẩu</label>
                  <div className="mt-1.5 relative">
                    <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input h-14 pl-12 rounded-xl text-[16px]"
                      type="password"
                      placeholder="••••••••"
                      {...rf("password", { required: "Vui lòng nhập mật khẩu" })}
                    />
                  </div>
                  <AnimatePresence>
                    {errors.password && (
                      <motion.p className="mt-1 text-sm text-rose-600" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        {errors.password.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[15px] text-slate-800">
                    <input type="checkbox" className="accent-emerald-600" {...rf("remember")} />
                    Ghi nhớ tôi
                  </label>
                  <Link to="/forgot" className="text-[15px] text-emerald-700 hover:text-emerald-600 transition">
                    Quên mật khẩu?
                  </Link>
                </div>

                <Button className="w-full h-14 text-[17px] font-semibold justify-center disabled:opacity-60" type="submit" disabled={loading}>
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>
              </form>

              <div className="mt-6 text-[15px] text-center text-slate-700">
                Chưa có tài khoản?{" "}
                <Link className="text-emerald-700 hover:text-emerald-600 font-semibold transition" to="/register">
                  Đăng ký
                </Link>
              </div>
            </Card>
          </motion.div>

          <motion.p
            className="mt-6 text-center text-sm text-slate-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            transition={{ delay: 0.6 }}
          >
            Bằng việc đăng nhập, bạn đồng ý với Điều khoản &amp; Chính sách bảo mật.
          </motion.p>
        </div>
      </div>

      {/* mép sáng trên */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        aria-hidden
      />
    </div>
  );
}
