// Register service worker and handle PWA installation
(function(){
  if (!('serviceWorker' in navigator)) return;
  
  let deferredPrompt;
  
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

  // Handle PWA installation prompt - Let browser handle it natively
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🔔 PWA install prompt available', e);
    // Don't prevent the default behavior - let browser show native prompt
    // Just store the event for potential manual triggering
    deferredPrompt = e;
  });

  // Handle successful installation
  window.addEventListener('appinstalled', (evt) => {
    console.log('✅ PWA was installed successfully');
    // Show success message
    if (window.showToast) {
      window.showToast('VendPlug installed successfully!');
    }
  });

  // Check if PWA is already installed
  function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
  }

  // Expose functions globally for manual triggering if needed
  window.installPWA = function() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
        } else {
          console.log('❌ User dismissed the install prompt');
        }
        deferredPrompt = null;
      });
    } else {
      console.log('No install prompt available');
    }
  };
  
  window.isPWAInstalled = isPWAInstalled;
})();