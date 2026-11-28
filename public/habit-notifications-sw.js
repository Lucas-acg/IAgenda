// Dedicated messaging worker: no app-shell caching or offline behavior.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); } catch { return; }
  event.waitUntil(self.registration.showNotification(message.title || "IAgenda", {
    body: message.body || "Você tem um hábito programado.",
    icon: "/icon-192.png", badge: "/icon-192.png", tag: message.tag || "iagenda-habit",
    data: { url: "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const page = pages.find((client) => new URL(client.url).origin === self.location.origin);
    if (page) { await page.navigate("/"); return page.focus(); }
    return self.clients.openWindow("/");
  })());
});