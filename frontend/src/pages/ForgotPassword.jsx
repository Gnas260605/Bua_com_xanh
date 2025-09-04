import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { email: "" },
  });
  const nav = useNavigate();

  const onSubmit = async ({ email }) => {
    try {
      const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await r.json().catch(() => ({}));

      // chấp nhận cả 2 kiểu cờ: ok/success = true
      const okFlag = data?.ok ?? data?.success ?? data?.status === "ok";

      if (!r.ok || okFlag === false) {
        alert(data?.message || "Không gửi được OTP. Kiểm tra email.");
        return;
      }

      alert("Đã gửi mã OTP về email.");
      nav(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      console.error(err);
      alert("Có lỗi mạng khi gửi OTP. Vui lòng thử lại.");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Card className="p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-1">Quên mật khẩu</h1>
        <p className="text-sm text-gray-600 mb-4">Nhập email để nhận mã OTP.</p>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              className="input w-full"
              type="email"
              placeholder="you@example.com"
              {...register("email", {
                required: "Vui lòng nhập email",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Email không hợp lệ",
                },
              })}
            />
          </div>
          {/* QUAN TRỌNG: thêm type="submit" */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Đang gửi..." : "Gửi OTP"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
