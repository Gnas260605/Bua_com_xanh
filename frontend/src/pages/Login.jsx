import { useForm } from "react-hook-form";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Login() {
  const { register: rf, handleSubmit, watch } = useForm({ defaultValues: { email: "", password: "", remember: true } });
  const { signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const onSubmit = async (v) => {
    try {
      await signIn(v.email, v.password, v.remember);
      const to = loc.state?.from?.pathname || "/";
      nav(to, { replace: true });
    } catch {
      alert("Đăng nhập thất bại");
    }
  };

  return (
    <div className="auth-split">
      {/* Background */}
      <div className="hidden lg:block auth-bg auth-bg-overlay" aria-hidden />
      {/* Form */}
      <div className="bg-gray-50 flex items-center justify-center p-6">
        <Card className="p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-1">Đăng nhập</h1>
          <p className="text-sm text-gray-600 mb-4">Sử dụng tài khoản đã đăng ký.</p>

          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <input className="input w-full" type="email" {...rf("email", { required: true })} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Mật khẩu</label>
              <input className="input w-full" type="password" {...rf("password", { required: true })} />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...rf("remember")} />
                Ghi nhớ tôi
              </label>
              <Link to="/forgot" className="text-sm text-emerald-700">Quên mật khẩu?</Link>
            </div>

            <Button className="w-full" type="submit">Đăng nhập</Button>
          </form>

          <div className="mt-3 text-sm text-center">
            Chưa có tài khoản?{" "}
            <Link className="text-emerald-700 font-medium" to="/register">Đăng ký</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
