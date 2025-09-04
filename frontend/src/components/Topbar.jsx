import { Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Topbar(){
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const avatar = user?.avatar_url || "https://i.pravatar.cc/64?img=12";

  useEffect(()=>{
    function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return ()=>document.removeEventListener("mousedown", onDoc);
  },[]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="h-14 px-4 flex items-center gap-3">
        <div className="md:hidden font-semibold">🍚 Bữa Cơm Xanh</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100">
            <Bell size={18}/>
          </button>
          <div className="relative" ref={ref}>
            <button className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-slate-100"
                    onClick={()=>setOpen(v=>!v)}>
              <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover"/>
              <ChevronDown size={16}/>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[180px] overflow-hidden">
                <button onClick={()=>{ setOpen(false); nav("/settings"); }}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50">Cài đặt</button>
                <button onClick={()=>{ setOpen(false); signOut(); }}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-rose-600">Đăng xuất</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
