import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Topbar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const avatar = user?.avatar_url || "/images/avatar-default.png";
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="h-14 px-4 flex items-center justify-end">
        <div className="relative" ref={ref}>
          <button className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-slate-100"
                  onClick={(e)=>{ e.stopPropagation(); setOpen(v=>!v); }}>
            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover"/>
            <ChevronDown size={16}/>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 z-[9999] min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                 onClick={(e)=>e.stopPropagation()}>
              <button className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={()=>{ setOpen(false); nav("/settings"); }}>
                Cài đặt
              </button>
              <button className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-rose-600"
                      onClick={()=>{ setOpen(false); signOut(); }}>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
