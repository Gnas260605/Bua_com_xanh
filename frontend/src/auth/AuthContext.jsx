import { createContext, useContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useNavigate } from "react-router-dom";

const Ctx = createContext(null);

export function AuthProvider({ children }){
  const t = useToast();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // load user từ token
  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet("/api/auth/me");
        setUser(me);
      } catch {} finally {
        setReady(true);
      }
    })();
  }, []);

  async function signIn(email, password, remember=false){
    const data = await apiPost("/api/auth/login", { email, password });
    (remember ? localStorage : sessionStorage).setItem("bua_token", data.token);
    setUser(data.user);
    t.success("Đăng nhập thành công");
    nav("/");
    return data;
  }

  async function signUp(payload){
    await apiPost("/api/auth/register", payload);
    t.success("Đăng ký thành công, hãy đăng nhập!");
    nav("/login");
  }

  function signOut(){
    localStorage.removeItem("bua_token");
    sessionStorage.removeItem("bua_token");
    setUser(null);
    t.info("Đã đăng xuất");
    nav("/login");
  }

  return <Ctx.Provider value={{ user, setUser, ready, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(){ return useContext(Ctx); }
