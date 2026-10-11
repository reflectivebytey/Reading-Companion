import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workerSource = readFileSync(new URL("../public/push-sw.js", import.meta.url), "utf8");

function createWorker({ rejectRich = false } = {}) {
  const handlers = new Map();
  const notifications = [];
  const navigated = [];
  const client = {
    url: "https://app.example/",
    async focus() {},
    async navigate(url) { navigated.push(url); return url; },
  };
  const self = {
    location: { origin: "https://app.example" },
    Notification: { maxActions: 2 },
    addEventListener(type, handler) { handlers.set(type, handler); },
    registration: {
      async showNotification(title, options) {
        if (rejectRich && (options.actions || options.image)) throw new TypeError("unsupported notification options");
        notifications.push({ title, options });
      },
    },
    clients: {
      async matchAll() { return [client]; },
      async openWindow(url) { navigated.push(url); },
    },
  };
  runInNewContext(workerSource, { self, URL, Promise, String, Array });
  return { handlers, notifications, navigated };
}

test("rich notifications expose brand assets and route an action to its deep link", async () => {
  const worker = createWorker();
  let pending;
  worker.handlers.get("push")({
    data: { json: () => ({
      type: "report_status", title: "Report #000012 is now In progress", body: "Review started.",
      image: "/release-2.6.0-banner.png", tag: "report-r-12", url: "/",
      data: { url: "/?open=reports&reportId=r-12", actions: [{ action: "view-report", title: "View report", url: "/?open=reports&reportId=r-12" }] },
      actions: [{ action: "view-report", title: "View report" }],
    }) },
    waitUntil(promise) { pending = promise; },
  });
  await pending;
  const { options } = worker.notifications[0];
  assert.equal(options.icon, "/pwa-192.png");
  assert.equal(options.badge, "/notification-badge.png");
  assert.equal(options.image, "/release-2.6.0-banner.png");
  assert.equal(options.renotify, true);
  assert.deepEqual(JSON.parse(JSON.stringify(options.actions)), [{ action: "view-report", title: "View report" }]);
  let clickPending;
  worker.handlers.get("notificationclick")({
    action: "view-report",
    notification: { data: options.data, close() {} },
    waitUntil(promise) { clickPending = promise; },
  });
  await clickPending;
  assert.deepEqual(worker.navigated, ["https://app.example/?open=reports&reportId=r-12"]);
});

test("unsupported image/actions retry with a plain compatible notification", async () => {
  const worker = createWorker({ rejectRich: true });
  let pending;
  worker.handlers.get("push")({
    data: { json: () => ({ title: "Reading Companion 2.6.0 is live", body: "New release", image: "/release.png", actions: [{ action: "update", title: "Update now" }] }) },
    waitUntil(promise) { pending = promise; },
  });
  await pending;
  assert.equal(worker.notifications.length, 1);
  assert.equal(worker.notifications[0].options.actions, undefined);
  assert.equal(worker.notifications[0].options.image, undefined);
  assert.equal(worker.notifications[0].options.data.url, "/");
});

test("legacy title/body/url/tag payloads still open their in-app destination", async () => {
  const worker = createWorker();
  let pending;
  worker.handlers.get("push")({
    data: { json: () => ({ title: "Old update", body: "Legacy payload", url: "/?legacy=1", tag: "old-tag" }) },
    waitUntil(promise) { pending = promise; },
  });
  await pending;
  assert.equal(worker.notifications[0].options.data.url, "/?legacy=1");
});