// src/pages/ResetPassword.jsx (Glassy Cyber-Modern • gradient heading • strength meter • glowing card)
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const code = sp.get("code") || "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { password: "", confirm: "" }, mode: "onTouched" });

  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [show, setShow] = useState({ a: false, b: false });

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

  useEffect(() => {
    setErr("");
    setOkMsg("");
  }, [email, code]);

  const pw = watch("password");
  const cf = watch("confirm");
  const pwLenOk = (pw || "").length >= 8;
  const pwMatch = pw && cf && pw === cf;

  // Strength 0..5
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pwLenOk) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw, pwLenOk]);

  const strengthText = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh", "Rất mạnh"][pwStrength] || "";

  const onSubmit = async ({ password, confirm }) => {
    setErr("");
    setOkMsg("");

    if (!email || !code) return setErr("Thiếu email hoặc mã xác thực (code) trên URL.");
    if (!password || !confirm) return setErr("Vui lòng nhập đầy đủ mật khẩu.");
    if (password.length < 8) return setErr("Mật khẩu tối thiểu 8 ký tự.");
    if (password !== confirm) return setErr("Mật khẩu nhập lại không khớp.");

    try {
      const r = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: password }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.message || "Không đặt lại được mật khẩu.");
      }

      setOkMsg("Đổi mật khẩu thành công. Hãy đăng nhập lại.");
      setTimeout(() => nav("/login", { replace: true }), 600);
    } catch (e) {
      setErr(e.message || "Không đặt lại được mật khẩu.");
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
              {/* inner ring + veil */}
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
                      Đặt lại mật khẩu
                    </span>
                  </h1>
                  <div className="mt-1 h-1.5 w-36 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px] text-slate-600 mb-2">
                <span>Email: <span className="font-medium text-slate-800">{email || "(không có email)"}</span></span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={16} className="text-emerald-600" /> An toàn
                </span>
              </div>

              {/* Alerts */}
              <AnimatePresence>
                {err && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2"
                    role="alert"
                  >
                    {err}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {okMsg && (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2"
                    role="status"
                  >
                    {okMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* New password */}
                <div>
                  <label htmlFor="password" className="text-[15px] font-medium text-slate-800">
                    Mật khẩu mới
                  </label>
                  <div className="mt-1.5 relative">
                    <input
                      id="password"
                      className="h-12 sm:h-14 w-full rounded-xl border border-slate-300 bg-white/90 pl-3 pr-10 text-[16px] outline-none ring-0 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 placeholder:text-slate-400"
                      type={show.a ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...register("password", { required: true, minLength: 8 })}
                      aria-describedby="pw-help"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                      onClick={() => setShow((s) => ({ ...s, a: !s.a }))}
                      aria-label={show.a ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {show.a ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const active = i < pwStrength;
                        return (
                          <div
                            key={i}
                            className={[
                              "h-1.5 w-10 rounded-full transition-all",
                              active
                                ? "bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400"
                                : "bg-slate-200",
                            ].join(" ")}
                          />
                        );
                      })}
                    </div>
                    <span id="pw-help" className={pw ? "text-xs text-slate-600" : "text-xs text-slate-500"}>
                      {pw ? `Độ mạnh: ${strengthText}` : "Tối thiểu 8 ký tự"}
                    </span>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirm" className="text-[15px] font-medium text-slate-800">
                    Nhập lại mật khẩu
                  </label>
                  <div className="mt-1.5 relative">
                    <input
                      id="confirm"
                      className={[
                        "h-12 sm:h-14 w-full rounded-xl border bg-white/90 pl-3 pr-10 text-[16px] outline-none ring-0 transition focus:ring-4 placeholder:text-slate-400",
                        "focus:border-emerald-500 focus:ring-emerald-100",
                        cf && !pwMatch ? "border-rose-400 focus:ring-rose-100 focus:border-rose-400" : "border-slate-300",
                      ].join(" ")}
                      type={show.b ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...register("confirm", { required: true, minLength: 8 })}
                      aria-invalid={!!cf && !pwMatch}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                      onClick={() => setShow((s) => ({ ...s, b: !s.b }))}
                      aria-label={show.b ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {show.b ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <div className="mt-1 text-xs">
                    <span className={cf ? (pwMatch ? "text-emerald-700" : "text-rose-600") : "text-slate-500"}>
                      {cf ? (pwMatch ? "Khớp" : "Chưa khớp") : ""}
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-14 text-[16px] sm:text-[17px] font-semibold justify-center disabled:opacity-60 rounded-xl shadow hover:shadow-md"
                  disabled={isSubmitting || !pwLenOk || !pwMatch}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={18} /> Đang đổi...
                    </span>
                  ) : (
                    "Đổi mật khẩu"
                  )}
                </Button>

                <p className="text-center text-[15px] text-slate-700">
                  Gặp vấn đề?{" "}
                  <Link className="font-semibold text-emerald-700 hover:text-emerald-600 transition" to="/forgot">
                    Gửi lại OTP
                  </Link>
                </p>
              </form>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
