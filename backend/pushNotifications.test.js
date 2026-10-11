import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPushPayload,
  createPushService,
  isReminderDue,
  localClock,
  normalizeReminderMinute,
  normalizeSubscription,
  normalizeTimezone,
} from "./pushNotifications.js";

const validSub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc_x-1", auth: "tBH-9" } };

test("normalizeSubscription accepts https endpoints with base64url keys only", () => {
  assert.deepEqual(normalizeSubscription(validSub), { endpoint: validSub.endpoint, p256dh: "BNc_x-1", auth: "tBH-9" });
  assert.equal(normalizeSubscription({ ...validSub, endpoint: "http://insecure.example/x" }), null);
  assert.equal(normalizeSubscription({ ...validSub, keys: { p256dh: "bad key!", auth: "x" } }), null);
  assert.equal(normalizeSubscription(null), null);
});

test("normalizers fall back safely", () => {
  assert.equal(normalizeTimezone("Asia/Kolkata"), "Asia/Kolkata");
  assert.equal(normalizeTimezone("Not/AZone"), "UTC");
  assert.equal(normalizeReminderMinute(1439), 1439);
  assert.equal(normalizeReminderMinute(1440), null);
  assert.equal(normalizeReminderMinute("12.5"), null);
  assert.equal(normalizeReminderMinute(null), null);
});

test("localClock converts to the reader's timezone", () => {
  const clock = localClock(new Date("2026-10-11T15:00:00Z"), "Asia/Kolkata");
  assert.deepEqual(clock, { day: "2026-10-11", minute: 20 * 60 + 30 });
});

test("isReminderDue fires once inside the window", () => {
  const now = new Date("2026-10-11T15:05:00Z"); // 20:35 in Kolkata
  const row = { reminder_minute: 20 * 60 + 30, timezone: "Asia/Kolkata", last_reminded_on: null };
  assert.equal(isReminderDue(row, now), true);
  assert.equal(isReminderDue({ ...row, last_reminded_on: "2026-10-11" }, now), false);
  assert.equal(isReminderDue({ ...row, reminder_minute: 21 * 60 }, now), false);
  assert.equal(isReminderDue({ ...row, reminder_minute: null }, now), false);
});

test("isReminderDue handles windows that cross midnight", () => {
  const row = { reminder_minute: 23 * 60 + 55, timezone: "UTC", last_reminded_on: "2026-10-10" };
  assert.equal(isReminderDue(row, new Date("2026-10-11T00:03:00Z")), true);
});

test("buildPushPayload trims fields and only allows in-app urls", () => {
  assert.equal(buildPushPayload({ title: " " }), null);
  const payload = JSON.parse(buildPushPayload({ title: "Hi", body: "There", url: "https://evil.example" }));
  assert.equal(payload.url, "/");
  assert.equal(JSON.parse(buildPushPayload({ title: "Hi", url: "//evil" })).url, "/");
  assert.equal(JSON.parse(buildPushPayload({ title: "Hi", url: "/?release=2.1.0" })).url, "/?release=2.1.0");
});

test("rich notification payload keeps legacy fields and adds safe typed actions and deep links", () => {
  const payload = JSON.parse(buildPushPayload({
    type: "report_status",
    title: "Report #000012 is now In progress",
    body: "We have started reviewing your report.",
    tag: "report-r-12",
    data: { url: "/?open=reports&reportId=r-12" },
    actions: [{ action: "view-report", title: "View report", url: "/?open=reports&reportId=r-12" }],
    image: "https://cdn.example/report.png",
  }));
  assert.equal(payload.type, "report_status");
  assert.equal(payload.url, "/?open=reports&reportId=r-12");
  assert.equal(payload.data.url, payload.url);
  assert.deepEqual(payload.actions, [{ action: "view-report", title: "View report", url: payload.url }]);
  assert.equal(payload.image, "https://cdn.example/report.png");
  assert.equal(payload.tag, "report-r-12");
});

test("notification text, actions, and total payload remain bounded", () => {
  const payloadText = buildPushPayload({
    title: "T".repeat(80),
    body: "B".repeat(240),
    type: "app_update",
    image: `/${"x".repeat(400)}`,
    actions: Array.from({ length: 8 }, (_, index) => ({ action: `action-${index}`, title: `Action ${index}` })),
    tag: "release",
  });
  const payload = JSON.parse(payloadText);
  assert.equal(payload.title.length, 50);
  assert.equal(payload.body.length, 120);
  assert.equal(payload.actions.length, 2);
  assert.ok(Buffer.byteLength(payloadText) < 3072);
});

test("only developer announcements can use external deep links", () => {
  assert.equal(JSON.parse(buildPushPayload({ title: "Update", data: { url: "https://outside.example" } })).url, "/");
  const announcement = JSON.parse(buildPushPayload({ type: "announcement", title: "Hello", data: { url: "https://example.org/news" } }));
  assert.equal(announcement.data.url, "https://example.org/news");
});

test("broadcast removes expired subscriptions and reports totals", async () => {
  const calls = [];
  const rows = [
    { endpoint: "https://push.example/1", p256dh: "a", auth: "b" },
    { endpoint: "https://push.example/2", p256dh: "a", auth: "b" },
  ];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    return { ok: true, json: async () => rows, text: async () => "" };
  };
  const sender = {
    setVapidDetails() {},
    async sendNotification(sub) {
      if (sub.endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    },
  };
  const service = createPushService({
    supabaseUrl: "https://db.example",
    serviceRoleKey: "service",
    vapidPublicKey: "pub",
    vapidPrivateKey: "priv",
    fetchImpl,
    sender,
  });
  const result = await service.broadcast(buildPushPayload({ title: "Hello" }));
  assert.deepEqual(result, { total: 2, sent: 1, failed: 0, removed: 1 });
  assert.ok(calls.some((call) => call.method === "DELETE" && call.url.includes(encodeURIComponent("https://push.example/2"))));
});

test("sendToEndpoint is exposed on the push service", () => {
  const svc = createPushService({ supabaseUrl: "", serviceRoleKey: "", vapidPublicKey: "", vapidPrivateKey: "", vapidSubject: "" });
  assert.equal(typeof svc.sendToEndpoint, "function");
});
