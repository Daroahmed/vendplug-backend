// Minimal floating back button for desktop/PWA
;(function(){
  try{
    const isTouch = matchMedia('(pointer: coarse)').matches;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    // Show only on desktop or standalone and when not the root/home
    const shouldEnable = !isTouch || isStandalone;
    if (!shouldEnable) return;

    const style = document.createElement('style');
    style.textContent = `
      .vp-back-btn{position:fixed;bottom:20px;left:20px;z-index:9999;display:none;align-items:center;gap:8px;background:rgba(30,30,30,.9);color:#fff;border:1px solid rgba(255,255,255,.1);padding:10px 12px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.35);cursor:grab;user-select:none;touch-action:none}
      .vp-back-btn.dragging{cursor:grabbing;opacity:.95}
      .vp-back-btn svg{width:16px;height:16px}
      .vp-back-btn.show{display:flex}
      @media (max-width: 768px){ .vp-back-btn{bottom:16px;left:16px} }
    `;
    document.head.appendChild(style);

    // Ensure singleton instance even if script is included multiple times
    const existing = document.querySelector('.vp-back-btn');
    if (existing) {
      // If more than one exists, keep the first and remove extras
      const extras = Array.from(document.querySelectorAll('.vp-back-btn')).slice(1);
      extras.forEach(el => { try{ el.remove(); }catch(_){ } });
    }
    const btn = existing || document.createElement('button');
    if (!existing) {
      btn.type = 'button';
      btn.className = 'vp-back-btn';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Back</span>';
    }

    function canGoBack(){
      // Heuristic: history length > 1 or there is a referrer from same origin
      const sameOriginRef = document.referrer && new URL(document.referrer).origin === location.origin;
      return (window.history.length > 1) || sameOriginRef;
    }

    function updateVisibility(){
      // Always show on desktop/PWA; let click handler decide behavior
      if (shouldEnable) btn.classList.add('show'); else btn.classList.remove('show');
    }

    if (!btn.__vpBound) btn.addEventListener('click', function(){
      if (btn._dragMoved) return; // ignore click right after drag
      if (canGoBack()) {
        window.history.back();
        setTimeout(updateVisibility, 350);
      } else {
        window.location.href = '/public-buyer-home.html';
      }
    });

    // ---- Drag to move (mouse/touch) ----
    const storageKey = `vp_back_btn_pos:${location.pathname}`;
    function loadPos(){
      try{
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const pos = JSON.parse(raw);
        // switch from bottom-based default to top/left for free placement
        btn.style.bottom = 'auto';
        if (typeof pos.top === 'number') btn.style.top = pos.top + 'px';
        if (typeof pos.left === 'number') btn.style.left = pos.left + 'px';
      }catch(_){/* ignore */}
    }
    function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
    function savePos(){
      try{
        const top = parseFloat(getComputedStyle(btn).top);
        const left = parseFloat(getComputedStyle(btn).left);
        if (Number.isFinite(top) && Number.isFinite(left)){
          localStorage.setItem(storageKey, JSON.stringify({ top, left }));
        }
      }catch(_){/* ignore */}
    }

    let startX=0, startY=0, startLeft=0, startTop=0;
    function onPointerDown(e){
      try{ e.preventDefault(); }catch(_){ }
      btn.classList.add('dragging');
      btn._dragMoved = false;
      // If we're still using bottom, convert to top for free move
      const rect = btn.getBoundingClientRect();
      btn.style.bottom = 'auto';
      btn.style.top = rect.top + 'px';
      btn.style.left = rect.left + 'px';
      startX = (e.touches ? e.touches[0].clientX : e.clientX) || 0;
      startY = (e.touches ? e.touches[0].clientY : e.clientY) || 0;
      startLeft = parseFloat(btn.style.left) || rect.left;
      startTop = parseFloat(btn.style.top) || rect.top;
      window.addEventListener('mousemove', onPointerMove, { passive:false });
      window.addEventListener('touchmove', onPointerMove, { passive:false });
      window.addEventListener('mouseup', onPointerUp, { passive:true, once:true });
      window.addEventListener('touchend', onPointerUp, { passive:true, once:true });
    }
    function onPointerMove(e){
      try{ e.preventDefault(); }catch(_){ }
      const x = (e.touches ? e.touches[0].clientX : e.clientX) || 0;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) || 0;
      const dx = x - startX;
      const dy = y - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) btn._dragMoved = true;
      const vw = window.innerWidth; const vh = window.innerHeight;
      const br = btn.getBoundingClientRect();
      const newLeft = clamp(startLeft + dx, 8, vw - br.width - 8);
      const newTop = clamp(startTop + dy, 8, vh - br.height - 8);
      btn.style.left = newLeft + 'px';
      btn.style.top = newTop + 'px';
    }
    function onPointerUp(){
      btn.classList.remove('dragging');
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      savePos();
      // small delay so click after drag is ignored
      setTimeout(()=>{ btn._dragMoved = false; }, 50);
    }
    if (!btn.__vpBound) {
      btn.addEventListener('mousedown', onPointerDown);
      btn.addEventListener('touchstart', onPointerDown, { passive:false });
      btn.__vpBound = true; // prevent double-binding if script reinjected
    }

    function mount(){
      if (!document.body.contains(btn)) {
        document.body.appendChild(btn);
      }
      loadPos();
      updateVisibility();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      // DOM is already ready (likely when script injected late) → mount now
      mount();
    }

    window.addEventListener('popstate', updateVisibility);
    window.addEventListener('hashchange', updateVisibility);
  }catch(_){/* no-op */}
})();


