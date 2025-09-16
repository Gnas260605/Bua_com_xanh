// src/pages/ForgotPassword.jsx (Glassy Cyber-Modern • big logo • gradient heading • glowing border)
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, ArrowLeft } from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function ForgotPassword() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
    setError,
  } = useForm({ defaultValues: { email: "" }, mode: "onTouched" });

  const nav = useNavigate();

  const [bgSrc, setBgSrc] = useState(BG_URL);
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgReady(true);
    img.onerror = () => {
      setBgSrc(BG_FALLBACK);
      setBgReady(true);
    };
    img.src = BG_URL;
  }, []);

  const onSubmit = async ({ email }) => {
    try {
      const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await r.json().catch(() => ({}));
      const okFlag = data?.ok ?? data?.success ?? data?.status === "ok";

      if (!r.ok || okFlag === false) {
        const msg = data?.message || "Không gửi được OTP. Kiểm tra email.";
        setError("email", { type: "server", message: msg });
        alert(msg); // có thể thay bằng Toast của bạn
        return;
      }

      alert("Đã gửi mã OTP về email."); // có thể thay bằng Toast
      nav(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      console.error(err);
      setError("email", {
        type: "network",
        message: "Có lỗi mạng khi gửi OTP. Vui lòng thử lại.",
      });
      alert("Có lỗi mạng khi gửi OTP. Vui lòng thử lại.");
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.5)_100%)]" />
        <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[url('/noise.png')]" />
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
      <div className="relative z-10 min-h-dvh w-full max-w-7xl mx-auto px-6 sm:px-10 grid place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 16 }}
          className="w-full max-w-md"
        >
          {/* Back link */}
          <div className="mb-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
            >
              <ArrowLeft size={16} /> Quay lại đăng nhập
            </Link>
          </div>

          {/* Fancy glowing card */}
          <div className="relative">
            <span className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-[conic-gradient(from_180deg_at_50%_50%,#22c55e33_0deg,#38bdf833_120deg,#a78bfa33_240deg,#22c55e33_360deg)] blur-[8px]" />
            <Card className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_12px_60px_rgba(0,0,0,0.35)] text-slate-900">
              {/* inner ring + soft veil */}
              <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/5" />
              <span className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-white/0 to-white/10" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={LOGO_URL}
                  alt="Bữa Cơm Xanh"
                  className="h-12 w-auto rounded-lg shadow-sm ring-1 ring-emerald-400/30"
                />
                <div>
                  <h1 className="text-3xl sm:text-[34px] font-extrabold leading-tight">
                    <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 bg-clip-text text-transparent">
                      Quên mật khẩu
                    </span>
                  </h1>
                  <div className="mt-1 h-1.5 w-28 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400" />
                </div>
              </div>
              <p className="text-[15px] text-slate-700 mb-6">
                Nhập email để nhận mã OTP đặt lại mật khẩu.
              </p>

              {/* Form */}
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="text-[15px] font-medium text-slate-800">
                    Email
                  </label>
                  <div className="mt-1.5 relative">
                    <Mail
                      aria-hidden
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      size={20}
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-12 sm:h-14 w-full rounded-xl border border-slate-300 bg-white/90 pl-12 pr-3 text-[16px] outline-none ring-0 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 placeholder:text-slate-400"
                      {...register("email", {
                        required: "Vui lòng nhập email",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
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
                        role="alert"
                        aria-live="polite"
                      >
                        {errors.email.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-14 text-[16px] sm:text-[17px] font-semibold justify-center disabled:opacity-60 rounded-xl shadow hover:shadow-md"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={18} /> Đang gửi...
                    </span>
                  ) : (
                    "Gửi OTP"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-[15px] text-center text-slate-700">
                Nhớ mật khẩu?{" "}
                <Link
                  to="/login"
                  className="text-emerald-700 hover:text-emerald-600 font-semibold transition"
                >
                  Đăng nhập
                </Link>
              </p>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
