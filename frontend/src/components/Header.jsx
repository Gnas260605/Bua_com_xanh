import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useEffect, useRef, useState } from "react";

function initials(name=""){ const p=name.trim().split(/\s+/); return (p[0]?.[0]||"").toUpperCase()+(p[1]?.[0]||"").toUpperCase(); }

export default function Header(){
  const { user, signOut } = useAuth();
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{ const onDoc=(e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click",onDoc); return ()=>document.removeEventListener("click",onDoc); },[]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="max-w-[1400px] mx-auto h-16 px-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700 text-xl">
          <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white grid place-items-center">B</span>
          Bữa Cơm Xanh
        </Link>

        <div className="hidden sm:flex ml-6 flex-1">
          <div className="relative w-full max-w-xl">
            <input className="input pl-10" placeholder="Tìm kiếm chiến dịch, người dùng..." />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          </div>
        </div>

        <button className="toolbar-icon" title="Thông báo">
          <span className="relative">🔔<span className="absolute -right-0 -top-0 w-2.5 h-2.5 bg-rose-500 rounded-full ring-breath"/></span>
        </button>

        <div className="relative" ref={ref}>
          <button className="w-10 h-10 rounded-full overflow-hidden grid place-items-center ring-1 ring-slate-200"
                  onClick={()=>setOpen(v=>!v)}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover"/>
              : <span className="text-sm font-semibold text-emerald-700">{initials(user?.name||user?.email)}</span>}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-64 card p-2 origin-top-right animate-[fadeIn_.15s_ease]">
              <div className="px-3 py-2">
                <div className="font-semibold">{user?.name||"Người dùng"}</div>
                <div className="text-slate-500 text-sm truncate">{user?.email}</div>
              </div>
              <Link className="block px-3 py-2 rounded-lg hover:bg-slate-100" to="/settings" onClick={()=>setOpen(false)}>⚙️ Cài đặt</Link>
              <Link className="block px-3 py-2 rounded-lg hover:bg-slate-100" to="/campaigns" onClick={()=>setOpen(false)}>🎯 Chiến dịch</Link>
              <button className="block w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600"
                      onClick={signOut}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
