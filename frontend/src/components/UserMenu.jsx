import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useClickAway from "../components/ui/useClickAway";
import { useAuth } from "../auth/AuthContext";

export default function UserMenu(){
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  useClickAway(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      {/* Quan trọng: dùng onMouseDown để ngăn blur sớm */}
      <button
        onMouseDown={(e)=>e.preventDefault()}
        onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border shadow-sm hover:shadow transition"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-200 grid place-items-center">
          {user?.avatar
            ? <img src={user.avatar} alt="avt" className="w-full h-full object-cover" />
            : <span className="text-sm font-semibold">{(user?.name?.[0]||"B").toUpperCase()}</span>}
        </div>
        <span className="text-sm">{user?.name || "Bạn"}</span>
        <span className="text-slate-500">▾</span>
      </button>

      {open && (
        // onMouseDown để KHÔNG đóng trước khi click nút bên trong
        <div
          onMouseDown={(e)=>e.stopPropagation()}
          className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur rounded-2xl shadow-lg border overflow-hidden z-50"
        >
          <button
            className="w-full text-left px-4 py-3 hover:bg-slate-100"
            onClick={()=>{ setOpen(false); nav("/settings"); }}
          >
            Cài đặt
          </button>
          <button
            className="w-full text-left px-4 py-3 hover:bg-slate-100 text-rose-600"
            onClick={()=>{ setOpen(false); signOut(); }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
