// src/pages/Login.jsx (Glassy Cyber-Modern • big logo • colored heading • glowing border)
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Mail, Lock, Eye, EyeOff, CheckCircle2, Loader2,
} from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function Login() {
  const { register: rf, handleSubmit, formState, setError } = useForm({
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = formState;
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [bgSrc, setBgSrc] = useState(BG_URL);
  const [bgReady, setBgReady] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgReady(true);
    img.onerror = () => {
      setBgSrc(BG_FALLBACK);
      setBgReady(true);
    };
    img.src = BG_URL;
  }, []);

  const onSubmit = async (v) => {
    try {
      await signIn(v.email, v.password, v.remember);
      const to = loc.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch {
      setShakeKey((k) => k + 1);
      setError("password", {
        type: "manual",
        message: "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.",
      });
    }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ===== Background (aurora + grid + texture) ===== */}
      <div className="absolute inset-0 -z-30">
        <img
          src={bgSrc}
          alt=""
          className="h-full w-full object-cover"
          style={{ opacity: bgReady ? 1 : 0, transition: "opacity .6s ease" }}
        />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 520px at 12% 8%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(1200px 700px at 88% 0%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 600px at 50% 100%, rgba(168,85,247,0.22), transparent 62%)",
          }}
        />
        {/* soft vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.5)_100%)]" />
        {/* noise texture */}
        <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[url('/noise.png')]" />
        {/* animated tech grid mask */}
        <motion.div
          aria-hidden
          className="absolute inset-0 [mask-image:radial-gradient(58%_58%_at_50%_42%,black,transparent)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ duration: 0.9 }}
        >
          <motion.div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]"
            animate={{ backgroundPosition: ["0px 0px", "44px 44px"] }}
            transition={{ duration: 12, ease: "linear", repeat: Infinity }}
          />
        </motion.div>
      </div>

      {/* top glow */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent -z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* ===== Content ===== */}
      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left hero */}
        <motion.section
          className="hidden lg:flex lg:col-span-7 px-10 xl:px-14 py-16"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="m-auto max-w-2xl">
            {/* Big logo */}
            <div className="flex items-center gap-5 mb-8">
              <motion.img
                src={LOGO_URL}
                alt="Bữa Cơm Xanh"
                className="h-16 w-auto rounded-xl shadow-[0_8px_40px_rgba(34,197,94,0.35)] ring-1 ring-emerald-400/30"
                initial={{ scale: 0.96, rotate: -1 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 12 }}
              />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight">
                  <span className="bg-gradient-to-r from-emerald-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent drop-shadow">
                    Bữa Cơm Xanh
                  </span>
                </h1>
                <p className="mt-2 text-slate-200/90">
                  Nền tảng quản trị quyên góp & vận hành hiện đại.
                </p>
              </motion.div>
            </div>

            {/* Feature bullets */}
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["Minh bạch số liệu", "Theo dõi realtime"],
                ["Tối ưu quy trình", "Phân quyền chặt chẽ"],
                ["Bảo mật", "Mã hoá & JWT"],
                ["Hiệu suất cao", "UI hiện đại"],
              ].map(([title, sub]) => (
                <li
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/7.5 p-4 backdrop-blur-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-sm text-slate-300/90">{sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Right form */}
        <section className="relative lg:col-span-5 flex items-center px-6 sm:px-10 py-10">
          {/* spotlight behind card */}
          <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 blur-3xl -z-10 w-[44rem] h-[44rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),rgba(255,255,255,0)_60%)]" />

          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 130, damping: 16 }}
            className="w-full max-w-md mx-auto"
          >
            {/* Fancy glowing border card */}
            <div className="relative">
              <span className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-[conic-gradient(from_180deg_at_50%_50%,#22c55e33_0deg,#38bdf833_120deg,#a78bfa33_240deg,#22c55e33_360deg)] blur-[8px]" />
              <Card className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_12px_60px_rgba(0,0,0,0.35)] text-slate-900">
                {/* inner ring */}
                <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/5" />
                {/* subtle gradient veil */}
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-white/0 to-white/10" />

                {/* Header */}
                <div className="relative mb-6">
                  <div className="flex items-center gap-3">
                    <img
                      src={LOGO_URL}
                      alt="Logo"
                      className="h-12 w-auto rounded-lg shadow-sm ring-1 ring-emerald-400/30"
                    />
                    <div>
                      <h2 className="text-3xl sm:text-[34px] font-extrabold leading-tight">
                        <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 bg-clip-text text-transparent">
                          Đăng nhập
                        </span>
                      </h2>
                      <div className="mt-1 h-1.5 w-28 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400" />
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] text-slate-700">
                    Sử dụng tài khoản đã đăng ký để tiếp tục.
                  </p>
                </div>

                {/* Form */}
                <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="text-[15px] font-medium text-slate-800">
                      Email
                    </label>
                    <div className="mt-1.5 relative">
                      <Mail aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                      <input
                        id="email"
                        autoComplete="email"
                        className="h-12 sm:h-14 w-full rounded-xl border border-slate-300 bg-white/90 pl-12 pr-3 text-[16px] outline-none ring-0 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 placeholder:text-slate-400"
                        type="email"
                        placeholder="you@example.com"
                        {...rf("email", {
                          required: "Vui lòng nhập email",
                          pattern: {
                            value: /[^\s@]+@[^\s@]+\.[^\s@]+/,
                            message: "Email không hợp lệ",
                          },
                        })}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                      />
                    </div>
                    <AnimatePresence>
                      {errors.email && (
                        <motion.p
                          id="email-error"
                          className="mt-1 text-sm text-rose-600"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {errors.email.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="text-[15px] font-medium text-slate-800">
                      Mật khẩu
                    </label>
                    <div className="mt-1.5 relative">
                      <Lock aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                      <input
                        id="password"
                        autoComplete="current-password"
                        className="h-12 sm:h-14 w-full rounded-xl border border-slate-300 bg-white/90 pl-12 pr-12 text-[16px] outline-none ring-0 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 placeholder:text-slate-400"
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        {...rf("password", { required: "Vui lòng nhập mật khẩu" })}
                        aria-invalid={!!errors.password}
                        aria-describedby={errors.password ? "password-error" : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                        aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {errors.password && (
                        <motion.p
                          id="password-error"
                          className="mt-1 text-sm text-rose-600"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {errors.password.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Options */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-[15px] text-slate-800 select-none">
                      <input type="checkbox" className="accent-emerald-600" {...rf("remember")} />
                      Ghi nhớ tôi
                    </label>
                    <Link
                      to="/forgot"
                      className="text-[15px] font-medium text-emerald-700 hover:text-emerald-600 transition"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>

                  {/* Submit */}
                  <Button
                    className="w-full h-12 sm:h-14 text-[16px] sm:text-[17px] font-semibold justify-center disabled:opacity-60 rounded-xl shadow hover:shadow-md"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={18} /> Đang đăng nhập...
                      </span>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-[15px] text-center text-slate-700">
                  Chưa có tài khoản?{" "}
                  <Link
                    className="text-emerald-700 hover:text-emerald-600 font-semibold transition"
                    to="/register"
                  >
                    Đăng ký
                  </Link>
                </p>
              </Card>
            </div>

            {/* terms */}
            <motion.p
              className="mt-6 text-center text-xs sm:text-sm text-slate-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.95 }}
              transition={{ delay: 0.4 }}
            >
              Bằng việc đăng nhập, bạn đồng ý với Điều khoản &amp; Chính sách bảo mật.
            </motion.p>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
