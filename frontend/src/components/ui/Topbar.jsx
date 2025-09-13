import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useEffect, useRef, useState } from "react";
import { useLayout } from "../layout/LayoutState.jsx";
import NotificationBell from "../ui/NotificationBell.jsx"; // ➜ thêm dòng này

function initials(name=""){ const p=name.trim().split(/\s+/); return (p[0]?.[0]||"").toUpperCase()+(p[1]?.[0]||"").toUpperCase(); }

export default function Topbar(){
  const { sidebarWidth } = useLayout();
  const { user, signOut } = useAuth();
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{ const onDoc=(e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click",onDoc); return ()=>document.removeEventListener("click",onDoc); },[]);

  return (
    <header
      style={{ ['--sbw']: `${sidebarWidth}px` }}
      className={[
        "sticky top-0 z-40",
        "bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "border-b border-slate-200",
        "md:ml-[var(--sbw)] md:w-[calc(100%-var(--sbw))]"
      ].join(" ")}
    >
      <div className="h-16 px-3 sm:px-4 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700 text-lg sm:text-xl tracking-wide">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-sm">B</span>
          <span className="leading-none">Bữa Cơm Xanh</span>
        </Link>

        <div className="hidden sm:flex ml-4 flex-1">
          <div className="relative w-full max-w-xl">
            <input className="w-full h-10 rounded-lg border border-slate-200 bg-white/90 pl-10 pr-3 text-[15px] outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder-slate-400" placeholder="Tìm kiếm chiến dịch, người dùng..." />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 select-none">🔎</span>
          </div>
        </div>

        {/* 🔔 Nút thông báo mới */}
        <NotificationBell />

        {/* Avatar menu */}
        <div className="relative" ref={ref}>
          <button className="w-10 h-10 rounded-full overflow-hidden grid place-items-center border border-slate-200 bg-white" onClick={()=>setOpen(v=>!v)} aria-haspopup="menu" aria-expanded={open}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover"/>
              : <span className="text-sm font-semibold text-emerald-700">{initials(user?.name||user?.email||"U S")}</span>}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-2 origin-top-right animate-[fadeIn_.12s_ease-out]" role="menu">
              <div className="px-3 py-2">
                <div className="font-semibold">{user?.name||"Người dùng"}</div>
                <div className="text-slate-500 text-sm truncate">{user?.email}</div>
              </div>
              <Link className="block px-3 py-2 rounded-lg hover:bg-slate-50" to="/settings" onClick={()=>setOpen(false)}>⚙️ Cài đặt</Link>
              <Link className="block px-3 py-2 rounded-lg hover:bg-slate-50" to="/campaigns" onClick={()=>setOpen(false)}>🎯 Chiến dịch</Link>
              <button className="block w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600" onClick={signOut}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
