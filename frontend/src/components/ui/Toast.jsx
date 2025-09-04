import { createContext, useContext, useState, useCallback } from "react";
// Use browser crypto API for UUIDs with a fallback
const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2,10);

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, message) => {
    const id = uuid();
    setItems(v => [...v, { id, type, message }]);
    setTimeout(() => setItems(v => v.filter(i => i.id !== id)), 3200);
  }, []);
  const api = {
    success: (m) => push("success", m),
    error:   (m) => push("error", m),
    info:    (m) => push("info", m),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-3">
        {items.map(i => (
          <div key={i.id} className={`transform transition-all duration-200 px-4 py-3 rounded-2xl min-w-[260px] shadow-lg ${
            i.type==="success" ? "bg-emerald-50 border border-emerald-200" :
            i.type==="error"   ? "bg-rose-50 border border-rose-200" :
                                  "bg-sky-50 border border-sky-200"
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-lg">
                {i.type==="success" ? "✅" : i.type==="error" ? "⛔" : "ℹ️"}
              </div>
              <div className="font-medium text-sm leading-tight">{i.message}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast(){ return useContext(ToastCtx); }
