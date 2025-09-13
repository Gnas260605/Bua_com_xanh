// Unified Button component (polymorphic + variants + type/disabled)
export default function Button({
  as: As = "button",           // polymorphic: 'button' | 'a' | 'div' | component
  type = "button",             // chỉ áp dụng khi As là 'button'
  variant = "solid",           // 'solid' | 'soft' | 'ghost' | 'danger' | 'primary'(alias)
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  // alias để tương thích code cũ: 'primary' == 'solid'
  const v = variant === "primary" ? "solid" : variant;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-transform duration-150 shadow-sm";

  const variants = {
  solid:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[.98] focus-visible:ring-emerald-200",
  soft:
    "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 focus-visible:ring-emerald-100",
  ghost:
    "bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 focus-visible:ring-slate-200",
  outline:
    "bg-white border border-emerald-400 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-100",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:scale-[.98] focus-visible:ring-rose-200",
};

  const disabledCls = disabled
    ? "opacity-60 cursor-not-allowed pointer-events-none"
    : "hover:translate-y-0.5";

  const cls = `${base} ${variants[v] || ""} ${disabledCls} ${className}`.trim();

  const isNativeButton = typeof As === "string" && As.toLowerCase() === "button";

  const propsToPass = {
    className: cls,
    ...(isNativeButton ? { type } : {}),           // chỉ truyền type cho <button>
    ...(isNativeButton ? { disabled } : {}),       // chỉ truyền disabled cho <button>
    ...rest,
  };

  return <As {...propsToPass}>{children}</As>;
}
