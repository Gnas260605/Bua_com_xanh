import { useEffect } from "react";

export default function DevHelpers(){
  useEffect(()=>{
    function scanOverlays(){
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const els = [...document.querySelectorAll('body *')];
      const blockers = els.filter(el=>{
        try{
          const s = getComputedStyle(el);
          if (s.visibility === 'hidden' || s.display === 'none') return false;
          if (!(s.position === 'fixed' || s.position === 'absolute' || s.position === 'sticky')) return false;
          const r = el.getBoundingClientRect();
          // large element covering viewport or very high z-index
          const covers = r.width >= vw-2 && r.height >= vh-2;
          const z = Number(s.zIndex) || 0;
          return covers || z >= 9998;
        }catch(e){ return false; }
      });

      if(blockers.length){
        console.warn('DevHelpers: possible blocking elements:', blockers);
        blockers.forEach(el=>{
          el.style.outline = '3px solid rgba(220,38,38,0.9)';
          el.style.outlineOffset = '-4px';
        });
      }
    }

    function onClick(e){
      const x = e.clientX, y = e.clientY;
      const el = document.elementFromPoint(x,y);
      console.log('DevHelpers: click at', x, y, 'element:', el, 'classes:', el?.className);
    }

    scanOverlays();
    window.addEventListener('resize', scanOverlays);
    document.addEventListener('click', onClick, true);
    return ()=>{
      window.removeEventListener('resize', scanOverlays);
      document.removeEventListener('click', onClick, true);
    };
  },[]);

  return null;
}
