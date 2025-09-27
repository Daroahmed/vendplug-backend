// Register service worker and handle update lifecycle
(function(){
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered', reg.scope);
      // Proactively check for updates
      try { if (reg.update) reg.update(); } catch(_){}

      // Reload once when a new SW takes control to ensure fresh assets
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (window.__vp_sw_reloaded) return;
        window.__vp_sw_reloaded = true;
        location.reload();
      });

      // Listen for SW messages to show one-time toast
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PRECACHE_READY') {
          try {
            if (!localStorage.getItem('vp_precache_toast_shown')) {
              window.showToast && window.showToast('Saved for offline use');
              localStorage.setItem('vp_precache_toast_shown', '1');
            }
          } catch(_){ }
        }
      });
    }).catch((err) => console.warn('SW registration failed', err));
  });
})();


