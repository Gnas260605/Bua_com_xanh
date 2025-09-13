export default function Modal({ open, onClose, title, children, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl transform transition-all duration-200 scale-100">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="ml-auto rounded-lg px-3 py-1 hover:bg-slate-100 transition" aria-label="Close">✕</button>
        </div>
        <div className="p-6">{children}</div>
        {actions && <div className="p-4 border-t flex gap-2 justify-end">{actions}</div>}
      </div>
    </div>
  );
}
