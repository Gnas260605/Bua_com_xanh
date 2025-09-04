import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function VerifyOtp() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const { register, handleSubmit } = useForm({ defaultValues: { code: "" } });
  const nav = useNavigate();

  const onSubmit = async ({ code }) => {
    const r = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!r.ok) {
      alert("Mã OTP không đúng hoặc đã hết hạn.");
      return;
    }
    nav(`/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Card className="p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-1">Xác thực OTP</h1>
        <p className="text-sm text-gray-600 mb-4">Nhập 6 chữ số đã gửi tới {email}.</p>
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
          <Button className="w-full">Xác thực</Button>
        </form>
      </Card>
    </div>
  );
}
