// Lightweight CTA banner to enable notifications
(function(){
  if (!('Notification' in window)) return;
  const perm = Notification.permission;
  if (perm === 'granted') return;

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;background:#1e1e1e;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  bar.innerHTML = '<div style="flex:1;">Enable notifications for order updates and support replies.</div>'+
                  '<button id="push-cta-allow" style="background:#00cc99;color:#000;border:0;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer">Enable</button>'+
                  '<button id="push-cta-dismiss" style="background:transparent;color:#00cc99;border:1px solid #00cc99;padding:8px 12px;border-radius:8px;font-weight:600;cursor:pointer">Later</button>';

  function show(){ document.body.appendChild(bar); }
  function hide(){ bar.remove(); }
  function tryEnable(){ window.enablePushIfPossible && window.enablePushIfPossible(); hide(); }

  window.addEventListener('load', () => {
    setTimeout(() => { show(); }, 2500);
  });
  bar.addEventListener('click', (e) => {
    if (e.target.id === 'push-cta-allow') tryEnable();
    if (e.target.id === 'push-cta-dismiss') hide();
  });
})();


