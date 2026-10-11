/* Push handlers imported into the generated Workbox service worker. */
function safeNotificationTarget(value, type) {
  if (typeof value !== "string" || !value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (type === "announcement") {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch { /* ignore invalid links */ }
  }
  return "/";
}

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Reading Companion", body: event.data ? event.data.text() : "" };
  }
  const type = data.type || "general";
  const targetUrl = safeNotificationTarget(data.data?.url || data.url, type);
  const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2).map(({ action, title: actionTitle, url }) => ({
    action: String(action || "").slice(0, 24),
    title: String(actionTitle || "").slice(0, 20),
    ...(url ? { url: safeNotificationTarget(url, type) } : {}),
  })).filter((action) => action.action && action.title) : [];
  const options = {
    body: String(data.body || "").slice(0, 120),
    icon: "/pwa-192.png",
    badge: "/notification-badge.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: type === "app_update",
    vibrate: type === "report_status" ? [120, 60, 120] : [80, 40, 80],
    data: { url: targetUrl, type, actions },
    ...(typeof data.image === "string" ? { image: data.image } : {}),
    ...(actions.length && (typeof self.Notification?.maxActions !== "number" || self.Notification.maxActions > 0)
      ? { actions: actions.map(({ action, title }) => ({ action, title })) }
      : {}),
  };
  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(String(data.title || "Reading Companion").slice(0, 50), options);
    } catch {
      const fallback = { ...options };
      delete fallback.image;
      delete fallback.actions;
      delete fallback.badge;
      delete fallback.vibrate;
      await self.registration.showNotification(String(data.title || "Reading Companion").slice(0, 50), fallback);
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const chosenAction = data.actions?.find((action) => action.action === event.action);
  if (event.action === "later") return;
  const path = safeNotificationTarget(chosenAction?.url || data.url || "/", data.type);
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if (new URL(target).origin !== self.location.origin) {
          await self.clients.openWindow(target);
        } else if (client.url !== target && "navigate" in client) {
          await client.navigate(target).catch(() => {});
        }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
