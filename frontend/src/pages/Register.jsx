import { useForm } from "react-hook-form";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const { register: rf, handleSubmit, watch } = useForm({ defaultValues: { name: "", email: "", address: "", password: "", confirm: "" } });
  const { register: signup } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (v) => {
    if (v.password !== v.confirm) {
      alert("Mật khẩu nhập lại không khớp.");
      return;
    }
    try {
      await signup({ name: v.name, email: v.email, address: v.address, password: v.password }, true);
      nav("/", { replace: true });
    } catch {
      alert("Đăng ký thất bại");
    }
  };

  return (
    <div className="auth-split">
      {/* Background */}
      <div className="hidden lg:block auth-bg auth-bg-overlay" aria-hidden />
      {/* Form */}
      <div className="bg-gray-50 flex items-center justify-center p-6">
        <Card className="p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-1">Đăng ký</h1>
          <p className="text-sm text-gray-600 mb-4">Tạo tài khoản để sử dụng hệ thống.</p>

          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm text-gray-600">Họ tên</label>
              <input className="input w-full" {...rf("name", { required: true })} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Email</label>
              <input className="input w-full" type="email" {...rf("email", { required: true })} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Địa chỉ</label>
              <input className="input w-full" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" {...rf("address", { required: true })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Mật khẩu</label>
                <input className="input w-full" type="password" {...rf("password", { required: true, minLength: 6 })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Nhập lại mật khẩu</label>
                <input className="input w-full" type="password" {...rf("confirm", { required: true, minLength: 6 })} />
              </div>
            </div>
            <Button className="w-full" type="submit">Đăng ký</Button>
          </form>

          <div className="mt-3 text-sm text-center">
            Đã có tài khoản?{" "}
            <Link className="text-emerald-700 font-medium" to="/login">Đăng nhập</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
