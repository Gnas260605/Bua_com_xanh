import { NavLink } from "react-router-dom";
import { Home, Target, Heart, Users, Truck, BarChart3, Settings } from "lucide-react";

const items = [
  { to:"/",          icon: Home,      label:"Tổng quan" },
  { to:"/campaigns", icon: Target,    label:"Chiến dịch" },
  { to:"/donors",    icon: Heart,     label:"Nhà hảo tâm" },
  { to:"/recipients",icon: Users,     label:"Người nhận" },
  { to:"/shippers",  icon: Truck,     label:"Shipper TNV" },
  { to:"/reports",   icon: BarChart3, label:"Báo cáo" },
  { to:"/settings",  icon: Settings,  label:"Cài đặt" },
];

export default function Sidebar(){
  return (
    <aside className="hidden md:flex w-[250px] flex-col border-r border-slate-200 bg-white/90">
      <div className="px-5 py-4 text-lg font-bold">🍚 Bữa Cơm Xanh</div>
      <nav className="px-3 pb-4 space-y-1">
        {items.map(({to, icon:Icon, label})=>(
          <NavLink key={to} to={to}
            className={({isActive})=>`flex items-center gap-3 px-3 py-2.5 rounded-xl
              ${isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-100"}`}>
            <Icon size={18}/> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-4 text-xs text-slate-500">v0.2 • UI refresh</div>
    </aside>
  );
}
