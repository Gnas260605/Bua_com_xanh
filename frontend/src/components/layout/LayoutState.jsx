import { createContext, useContext, useMemo, useState } from "react";

const LayoutCtx = createContext(null);

export function LayoutProvider({ children }) {
  // collapsed = true -> 80px; false -> 264px
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 80 : 264;

  const value = useMemo(
    () => ({
      collapsed,
      sidebarWidth,
      toggleSidebar: () => setCollapsed(v => !v),
      setCollapsed,
    }),
    [collapsed, sidebarWidth]
  );

  return <LayoutCtx.Provider value={value}>{children}</LayoutCtx.Provider>;
}

export function useLayout() {
  const ctx = useContext(LayoutCtx);
  if (!ctx) throw new Error("useLayout must be used inside <LayoutProvider>");
  return ctx;
}
