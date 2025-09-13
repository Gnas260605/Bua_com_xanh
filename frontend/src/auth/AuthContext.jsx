import { createContext, useContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useNavigate } from "react-router-dom";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const t = useToast();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true khi đã kiểm tra token xong

  // Load user từ token khi app khởi động / F5
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet("/api/auth/me"); // res = { user: {...} }
        setUser(res?.user ?? null);               // ✅ LẤY res.user
      } catch {
        setUser(null);                             // token không hợp lệ
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Đăng nhập
  async function signIn(email, password, remember = false) {
    const data = await apiPost("/api/auth/login", { email, password, remember });
    (remember ? localStorage : sessionStorage).setItem("bua_token", data.token);
    setUser(data.user);                            // ✅ user là object thực
    t.success("Đăng nhập thành công");
    nav("/");
    return data;
  }

  // Đăng ký
  async function signUp({ name, email, address, password }) {
    await apiPost("/api/auth/register", { name, email, address, password });
    t.success("Đăng ký thành công, hãy đăng nhập!");
    nav("/login");
  }

  // Đăng xuất
  function signOut() {
    localStorage.removeItem("bua_token");
    sessionStorage.removeItem("bua_token");
    setUser(null);
    t.info("Đã đăng xuất");
    nav("/login");
  }

  return (
    <Ctx.Provider value={{ user, setUser, ready, signIn, signUp, signOut, register: signUp }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
