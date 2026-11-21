// Push notifications of Ordo (lot 17c, decision FU). A classic script, outside the bundle (public/), imported by the
// service worker that vite-plugin-pwa generates (workbox `importScripts`, vite.config.ts). The server pushes a ring of
// an alarm or a reminder ({ key, title, body, path, workspaceId, actions }, `PushPayload` of @ordo/shared):
// - a tab of the app visible: no notification, the tab rings it itself (its looped ringtone, `ringPushed`);
// - otherwise: a system notification (the sound and vibration of the system, once per send), tag `ordo.alarm.<key>`
//   so a resend replaces it, with « Arrêter » and « Répéter dans N min ».
// Its buttons call the API (same origin, session cookie): `stopAlarmRing`, `snoozeAlarmRing`; a click on its body opens
// the app on its page, in its workspace.
(function () {
  /** Vibration of a ring: long, short, long. */
  var VIBRATE = [400, 200, 400, 200, 800];
  var MUTATIONS = {
    stop: 'mutation PushStopAlarmRing($key: String!) { stopAlarmRing(key: $key) }',
    snooze: 'mutation PushSnoozeAlarmRing($key: String!) { snoozeAlarmRing(key: $key) { id } }',
  };

  /**
   * Windows of the app (those not yet controlled by this worker too).
   * @returns {Promise<WindowClient[]>} Windows.
   */
  function appWindows() {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  }

  /**
   * Tells every window of the app something.
   * @param {object} message Message.
   * @returns {Promise<void>} Done.
   */
  function tellWindows(message) {
    return appWindows().then(function (windows) {
      windows.forEach(function (client) {
        client.postMessage(message);
      });
    });
  }

  self.addEventListener('push', function (event) {
    var data = null;
    try {
      data = event.data ? event.data.json() : null;
    } catch (error) {
      data = null;
    }
    if (!data || !data.title) return;
    event.waitUntil(
      appWindows().then(function (windows) {
        var visible = windows.filter(function (client) {
          return client.visibilityState === 'visible';
        });
        // A visible tab rings it itself (a test always shows).
        if (data.key && visible.length) {
          visible.forEach(function (client) {
            client.postMessage({ type: 'ordo.push.ring', key: data.key });
          });
          return undefined;
        }
        return self.registration.showNotification(data.title, {
          body: data.body || undefined,
          tag: data.key ? 'ordo.alarm.' + data.key : 'ordo.push.test',
          renotify: true,
          requireInteraction: Boolean(data.key),
          vibrate: VIBRATE,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          actions: data.actions || [],
          data: { key: data.key, path: data.path || '/', workspaceId: data.workspaceId || null },
        });
      }),
    );
  });

  /**
   * Stops or snoozes a ring with the API (session cookie), then tells the open tabs.
   * @param {'stop' | 'snooze'} action Action.
   * @param {string} key Key of the ring.
   * @returns {Promise<void>} Done (a failure is left: the ring is pushed again at its next ring).
   */
  function answer(action, key) {
    return fetch('/api/graphql', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: MUTATIONS[action], variables: { key: key } }),
    })
      .then(function () {
        return tellWindows({ type: 'ordo.push.changed' });
      })
      .catch(function () {
        return undefined;
      });
  }

  /**
   * Opens the page of a ring in its workspace: in a window of the app (focused, it opens it itself), else in a new one
   * (its address names the workspace: `ordo-workspace`).
   * @param {{ path: string, workspaceId: string | null }} target Page and workspace.
   * @returns {Promise<unknown>} Done.
   */
  function open(target) {
    return appWindows().then(function (windows) {
      var client = windows[0];
      if (client && 'focus' in client) {
        return client.focus().then(function (focused) {
          (focused || client).postMessage({ type: 'ordo.push.open', path: target.path, workspaceId: target.workspaceId });
        });
      }
      var url = new URL(target.path, self.location.origin);
      if (target.workspaceId) url.searchParams.set('ordo-workspace', target.workspaceId);
      return self.clients.openWindow(url.pathname + url.search);
    });
  }

  self.addEventListener('notificationclick', function (event) {
    var notification = event.notification;
    var data = notification.data || {};
    notification.close();
    if (data.key && (event.action === 'stop' || event.action === 'snooze')) {
      event.waitUntil(answer(event.action, data.key));
      return;
    }
    event.waitUntil(open({ path: data.path || '/', workspaceId: data.workspaceId || null }));
  });
})();
