import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const code = sp.get("code") || "";
  const { register, handleSubmit } = useForm({ defaultValues: { password: "", confirm: "" } });
  const nav = useNavigate();

  const onSubmit = async ({ password, confirm }) => {
    if (password !== confirm) {
      alert("Mật khẩu nhập lại không khớp.");
      return;
    }
    const r = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword: password }),
    });
    if (!r.ok) {
      alert("Không đặt lại được mật khẩu.");
      return;
    }
    alert("Đổi mật khẩu thành công. Hãy đăng nhập lại.");
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <Card className="p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-1">Đặt lại mật khẩu</h1>
        <p className="text-sm text-gray-600 mb-4">Email: {email}</p>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm text-gray-600">Mật khẩu mới</label>
            <input className="input w-full" type="password" {...register("password", { required: true, minLength: 6 })} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Nhập lại mật khẩu</label>
            <input className="input w-full" type="password" {...register("confirm", { required: true, minLength: 6 })} />
          </div>
          <Button className="w-full">Đổi mật khẩu</Button>
        </form>
      </Card>
    </div>
  );
}
