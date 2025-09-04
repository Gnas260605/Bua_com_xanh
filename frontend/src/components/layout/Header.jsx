import { Menu, Bell } from "lucide-react";

export default function Header({ onToggleSidebar }) {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-3 sticky top-0 z-20">
      <button className="lg:hidden p-2 rounded-lg border hover:bg-gray-50" onClick={onToggleSidebar}>
        <Menu className="w-5 h-5" />
      </button>
      <div className="text-sm text-gray-500">Kết nối bữa ăn dư thừa tới người cần • An toàn • Minh bạch</div>
      <div className="ml-auto flex items-center gap-2">
        <button className="p-2 rounded-lg border hover:bg-gray-50">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
