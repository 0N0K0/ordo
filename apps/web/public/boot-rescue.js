// Rescue of a version broken while loading. A classic script, outside the bundle (public/), run before the app: an
// error before the app has started (main.tsx sets data-app-started on <html>) means its update toast can never show.
// Then the new version waiting in the service worker (or found now) is switched to at once (SKIP_WAITING, the message
// the generated service worker listens to), and the page reloads into it. Once per tab session, so a version that
// still breaks cannot loop.
(function () {
  if (!('serviceWorker' in navigator)) return;
  var KEY = 'ordo-boot-rescued';
  var tried = false;

  /**
   * Switches to a waiting service worker, then reloads once it controls the page.
   * @param {ServiceWorker} worker Installed service worker, waiting.
   * @returns {void}
   */
  function apply(worker) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      window.location.reload();
    });
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Waits for a service worker being installed, then switches to it.
   * @param {ServiceWorker} worker Service worker installing or installed.
   * @returns {void}
   */
  function applyWhenInstalled(worker) {
    if (worker.state === 'installed') return apply(worker);
    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed') apply(worker);
    });
  }

  /**
   * On an error before the app has started: looks for a new version and switches to it.
   * @returns {void}
   */
  function rescue() {
    if (tried || document.documentElement.hasAttribute('data-app-started')) return;
    tried = true;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch (error) {
      return;
    }
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (!registration) return;
      if (registration.waiting) return apply(registration.waiting);
      if (registration.installing) return applyWhenInstalled(registration.installing);
      registration.update().then(function () {
        var worker = registration.waiting || registration.installing;
        if (worker) applyWhenInstalled(worker);
      });
    });
  }

  window.addEventListener('error', rescue);
  window.addEventListener('unhandledrejection', rescue);
})();
