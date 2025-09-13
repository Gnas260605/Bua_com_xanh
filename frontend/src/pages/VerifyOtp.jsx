import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";

export default function VerifyOtp() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const next = sp.get("next") || "reset-password";
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { code: "" } });
  const nav = useNavigate();
  const [err, setErr] = useState("");

  const onSubmit = async ({ code }) => {
    setErr("");
    const c = String(code || "").trim();
    if (!email) return setErr("Thiếu email trên URL.");
    if (c.length !== 6) return setErr("Mã OTP cần đủ 6 số.");

    try {
      const r = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: c }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) return setErr(data?.message || "Mã OTP không đúng hoặc đã hết hạn.");

      nav(`/${next}?email=${encodeURIComponent(email)}&code=${encodeURIComponent(c)}`);
    } catch {
      setErr("Không thể kết nối máy chủ. Kiểm tra API_BASE và CORS.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Card className="p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-1">Xác thực OTP</h1>
        <p className="text-sm text-gray-600 mb-4">Nhập 6 chữ số đã gửi tới {email || "(không có email)"}.</p>
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-gray-600">Mã OTP</label>
            <input
              className="input w-full"
              inputMode="numeric"
              maxLength={6}
              {...register("code", { required: true })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang kiểm tra..." : "Xác thực"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
