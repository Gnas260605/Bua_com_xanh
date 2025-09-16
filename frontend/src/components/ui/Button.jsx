// Unified Button component (polymorphic + variants + type/disabled)
export default function Button({
  as: As = "button",          // 'button' | 'a' | custom component
  type = "button",            // chỉ áp dụng khi As là 'button'
  variant = "solid",          // 'solid' | 'soft' | 'ghost' | 'outline' | 'danger' | 'primary'(alias)
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  // alias cũ
  const v = variant === "primary" ? "solid" : variant;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm " +
    "transition-transform duration-150 focus:outline-none focus-visible:ring-4";

  // Màu bình thường (rõ nét, không mờ)
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

  // Trạng thái disabled: KHÔNG GIẢM OPACITY, chỉ khóa tương tác & bỏ hiệu ứng hover/active
  const disabledVariants = {
    solid:   "bg-emerald-500 text-white",
    soft:    "bg-emerald-100 text-emerald-800 border border-emerald-200",
    ghost:   "bg-slate-100 text-slate-800 border border-slate-200",
    outline: "bg-white text-emerald-700 border border-emerald-300",
    danger:  "bg-rose-500 text-white",
  };

  const stateCls = disabled
    ? `cursor-not-allowed ${disabledVariants[v] || ""}`
    : "hover:-translate-y-0.5 active:translate-y-[0]";

  const cls = `${base} ${variants[v] || ""} ${stateCls} ${className}`.trim();

  const isNativeButton =
    typeof As === "string" && As.toLowerCase() === "button";

  const propsToPass = {
    className: cls,
    ...(isNativeButton ? { type } : {}),
    ...(isNativeButton ? { disabled } : {}),
    // Khi không phải <button>, vẫn chặn tương tác bằng aria-disabled
    ...(!isNativeButton && disabled ? { "aria-disabled": true, tabIndex: -1 } : {}),
    ...rest,
  };

  return <As {...propsToPass}>{children}</As>;
}
