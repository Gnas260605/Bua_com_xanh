import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const code  = sp.get("code")  || "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting }
  } = useForm({ defaultValues: { password: "", confirm: "" } });

  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [show, setShow] = useState({ a: false, b: false });

  const pw = watch("password");
  const cf = watch("confirm");

  const pwLenOk = (pw || "").length >= 8;
  const pwMatch = pw && cf && pw === cf;

  // ước lượng strength đơn giản
  const pwStrength = useMemo(() => {
    let s = 0;
    if (pwLenOk) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s; // 0..5
  }, [pw, pwLenOk]);

  const strengthText = ["Rất yếu","Yếu","Trung bình","Khá","Mạnh","Rất mạnh"][pwStrength] || "";

  useEffect(() => {
    setErr("");
    setOkMsg("");
  }, [email, code]);

  const onSubmit = async ({ password, confirm }) => {
    setErr("");
    setOkMsg("");

    if (!email || !code) { setErr("Thiếu email hoặc mã xác thực (code) trên URL."); return; }
    if (!password || !confirm) { setErr("Vui lòng nhập đầy đủ mật khẩu."); return; }
    if (password.length < 8) { setErr("Mật khẩu tối thiểu 8 ký tự."); return; }
    if (password !== confirm) { setErr("Mật khẩu nhập lại không khớp."); return; }

    try {
      const r = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: password }),
      });

      // luôn cố đọc JSON để lấy message
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.message || "Không đặt lại được mật khẩu.");
      }

      setOkMsg("Đổi mật khẩu thành công. Hãy đăng nhập lại.");
      // chờ 600ms cho người dùng đọc rồi chuyển trang
      setTimeout(() => nav("/login", { replace: true }), 600);
    } catch (e) {
      setErr(e.message || "Không đặt lại được mật khẩu.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Card className="p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Đặt lại mật khẩu</h1>
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <ShieldCheck size={16}/> An toàn
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4">Email: {email || "(không có email)"}</p>

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
        {okMsg && <div className="mb-3 text-sm text-emerald-700">{okMsg}</div>}

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-gray-600">Mật khẩu mới</label>
            <div className="relative">
              <input
                className="input w-full pr-10"
                type={show.a ? "text" : "password"}
                autoComplete="new-password"
                {...register("password", { required: true, minLength: 8 })}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70"
                onClick={() => setShow(s => ({ ...s, a: !s.a }))}
                aria-label={show.a ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {show.a ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={pwLenOk ? "text-emerald-700" : "text-gray-500"}>
                {pw ? `Độ mạnh: ${strengthText}` : "Tối thiểu 8 ký tự"}
              </span>
              <span className={pwMatch ? "text-emerald-700" : "text-gray-500"}>
                {cf ? (pwMatch ? "Khớp" : "Chưa khớp") : ""}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Nhập lại mật khẩu</label>
            <div className="relative">
              <input
                className={`input w-full pr-10 ${cf && !pwMatch ? "border-red-500" : ""}`}
                type={show.b ? "text" : "password"}
                autoComplete="new-password"
                {...register("confirm", { required: true, minLength: 8 })}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70"
                onClick={() => setShow(s => ({ ...s, b: !s.b }))}
                aria-label={show.b ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {show.b ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
          </div>

          {/* ĐẢM BẢO LÀ type="submit" */}
          <Button type="submit" className="w-full" disabled={isSubmitting || !pwLenOk || !pwMatch}>
            {isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
          </Button>

          {/* Nếu Button là component custom, có thể test nhanh bằng <button> thuần: */}
          {/* <button type="submit" className="btn w-full" disabled={isSubmitting || !pwLenOk || !pwMatch}>
              {isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
            </button> */}
        </form>
      </Card>
    </div>
  );
}
