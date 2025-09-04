import { useEffect } from "react";

export default function useClickAway(ref, onAway){
  useEffect(() => {
    function onDown(e){ if(ref.current && !ref.current.contains(e.target)) onAway?.(e); }
    function onKey(e){ if(e.key === "Escape") onAway?.(e); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onAway]);
}
