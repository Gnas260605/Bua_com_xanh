import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, MapPin, Eye, EyeOff } from "lucide-react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";

/* =====================================================
   Register page — high-contrast, premium look
   - 60/40 layout (hero/form)
   - Readable typography
   - Light card on dark cosmos background
   - Subtle background particles (no distracting meteors)
   - Card hover lift + glossy CTA
===================================================== */

export default function Register() {
  const { register: rf, handleSubmit, formState, watch } = useForm({
    mode: "onBlur",
    defaultValues: { name: "", email: "", address: "", password: "", confirm: "" },
  });
  const { errors } = formState;

  const { register: signup } = useAuth();
  const nav = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const password = watch("password");
  const confirm = watch("confirm");
  const pwMatch = useMemo(() => password && confirm && password === confirm, [password, confirm]);

  const onSubmit = async (v) => {
    if (v.password !== v.confirm) {
      alert("Mật khẩu nhập lại không khớp.");
      return;
    }
    try {
      await signup({ name: v.name, email: v.email, address: v.address, password: v.password }, true);
      nav("/", { replace: true });
    } catch (err) {
      console.error(err);
      alert("Đăng ký thất bại");
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#0c1222] via-[#0e1a2b] to-[#0b1323] text-white">
      {/* Background glows */}
      <div className="absolute inset-0 bg-[radial-gradient(1100px_600px_at_-10%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(900px_500px_at_110%_120%,rgba(99,102,241,0.25),transparent)]" />

      {/* Particles */}
      <Particles density={80} />

      {/* Main content: 60/40 grid */}
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* Left hero */}
        <div className="flex flex-col items-center justify-center p-8 lg:p-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
              Chào mừng đến với <span className="bg-gradient-to-r from-emerald-300 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">Bữa Cơm Xanh</span>
            </h2>
            <p className="mt-4 text-lg text-white/85 max-w-xl">
              Kết nối nhà hảo tâm, người nhận và tình nguyện viên. Cùng lan tỏa những bữa cơm ấm áp mỗi ngày.
            </p>
            <ul className="mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
              {["Tài khoản một chạm","Theo dõi quyên góp","Thông báo thời gian thực","Bảo mật & riêng tư"].map((t) => (
                <li key={t} className="rounded-xl border border-white/15 bg-white/10 p-4 text-center text-base font-semibold backdrop-blur hover:border-emerald-400 hover:bg-emerald-400/10 transition">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: 40% column form */}
        <div className="relative flex items-center justify-center p-6 lg:p-10">
          {/* glow behind card */}
          <div className="pointer-events-none absolute -inset-x-6 top-24 hidden lg:block">
            <div className="mx-auto h-40 max-w-md rounded-full bg-emerald-400/20 blur-3xl" />
          </div>

          <div className="group relative w-full w-[min(40vw,560px)] max-w-xl">
            <Card className="w-full border-0 bg-white text-slate-800 shadow-2xl ring-1 ring-black/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_40px_120px_-20px_rgba(16,185,129,0.35)] rounded-2xl">
              <div className="p-8">
                <header className="mb-6">
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Đăng ký</h1>
                  <p className="mt-1 text-lg text-slate-600">Tạo tài khoản để sử dụng hệ thống.</p>
                </header>

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <Field label="Họ tên" error={errors.name?.message}>
                    <input
                      className="block w-full rounded-xl border border-slate-300 bg-slate-50/80 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                      autoComplete="name"
                      {...rf("name", { required: "Vui lòng nhập họ tên" })}
                    />
                  </Field>

                  <Field label="Email" error={errors.email?.message}>
                    <input
                      className="block w-full rounded-xl border border-slate-300 bg-slate-50/80 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      {...rf("email", { required: "Vui lòng nhập email" })}
                    />
                  </Field>

                  <Field label="Địa chỉ" error={errors.address?.message}>
                    <input
                      className="block w-full rounded-xl border border-slate-300 bg-slate-50/80 px-3 py-2.5 text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                      autoComplete="street-address"
                      {...rf("address", { required: "Vui lòng nhập địa chỉ" })}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Mật khẩu" error={errors.password?.message}>
                      <div className="relative">
                        <input
                          className="block w-full rounded-xl border border-slate-300 bg-slate-50/80 px-3 py-2.5 pr-10 text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                          type={showPw ? "text" : "password"}
                          autoComplete="new-password"
                          {...rf("password", { required: "Vui lòng nhập mật khẩu", minLength: { value: 6, message: "Tối thiểu 6 ký tự" } })}
                        />
                        <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-700">
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </Field>

                    <Field label="Nhập lại mật khẩu" error={errors.confirm?.message || (confirm && !pwMatch ? "Không khớp" : undefined)}>
                      <div className="relative">
                        <input
                          className={`block w-full rounded-xl border px-3 py-2.5 pr-10 text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 ${
                            confirm && !pwMatch ? "border-rose-500 bg-rose-50/60" : "border-slate-300 bg-slate-50/80"
                          }`}
                          type={showPw2 ? "text" : "password"}
                          autoComplete="new-password"
                          {...rf("confirm", { required: "Vui lòng nhập lại mật khẩu", minLength: { value: 6, message: "Tối thiểu 6 ký tự" } })}
                        />
                        <button type="button" onClick={() => setShowPw2((s) => !s)} className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-700">
                          {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  {/* Shiny CTA button */}
                  <button type="submit" className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-lg font-semibold text-white shadow-lg transition hover:shadow-emerald-500/30 focus:outline-none">
                    <span className="absolute inset-0 -translate-x-full bg-white/30 blur-md transition group-hover:translate-x-full" />
                    <span className="relative">Đăng ký</span>
                  </button>
                </form>

                <div className="mt-6 text-center text-base text-slate-600">
                  Đã có tài khoản? <Link className="font-semibold text-emerald-600 hover:text-emerald-500" to="/login">Đăng nhập</Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-base font-semibold text-slate-800">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function Particles({ density = 80 }) {
  const dots = Array.from({ length: density }, (_, i) => ({
    key: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 1.6 + 0.6,
    opacity: Math.random() * 0.7 + 0.2,
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.key}
          className="absolute rounded-full bg-white"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, opacity: d.opacity, boxShadow: "0 0 6px rgba(255,255,255,.6)" }}
        />
      ))}
    </div>
  );
}
