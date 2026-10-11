import webpush from "web-push";

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const MAX_ENDPOINT_LENGTH = 1024;
const REMINDER_WINDOW_MINUTES = 15;
const SUBSCRIPTION_COLUMNS = "endpoint,p256dh,auth,reminder_minute,timezone,last_reminded_on";

const REMINDER_MESSAGES = [
  { title: "Your reading time is here", body: "This is usually when you read. Ready to pick up where you left off?" },
  { title: "Time for a chapter?", body: "Your companion is ready whenever you are — a few pages keep the habit going." },
  { title: "Reading break?", body: "You tend to read around now. Let's continue your story together." },
];

export function normalizeSubscription(input) {
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint.trim() : "";
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (typeof p256dh !== "string" || p256dh.length > 200 || !BASE64URL.test(p256dh)) return null;
  if (typeof auth !== "string" || auth.length > 100 || !BASE64URL.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export function normalizeTimezone(timezone) {
  if (typeof timezone !== "string" || !timezone || timezone.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function normalizeReminderMinute(value) {
  if (value === null || value === undefined || value === "") return null;
  const minute = Number(value);
  return Number.isInteger(minute) && minute >= 0 && minute < 1440 ? minute : null;
}

export function localClock(date, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function isReminderDue(row, now = new Date(), windowMinutes = REMINDER_WINDOW_MINUTES) {
  const target = normalizeReminderMinute(row?.reminder_minute);
  if (target === null) return false;
  const { day, minute } = localClock(now, row.timezone);
  if (row.last_reminded_on === day) return false;
  return (minute - target + 1440) % 1440 < windowMinutes;
}

function safeNotificationUrl(value, type) {
  if (typeof value !== "string" || !value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value.slice(0, 512);
  if (type === "announcement") {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) return parsed.href.slice(0, 512);
    } catch { /* invalid URLs fall back to the app */ }
  }
  return "/";
}

export function buildPushPayload({ title, body, url = "/", tag, type = "general", image, actions, data } = {}) {
  const cleanTitle = String(title || "").trim().slice(0, 50);
  const cleanBody = String(body || "").trim().slice(0, 120);
  if (!cleanTitle) return null;
  const allowedTypes = new Set(["general", "report_status", "app_update", "announcement"]);
  const notificationType = allowedTypes.has(type) ? type : "general";
  const safeUrl = safeNotificationUrl(data?.url ?? url, notificationType);
  const safeImage = typeof image === "string" && image.length <= 512
    ? safeNotificationUrl(image, "announcement")
    : "/";
  const safeActions = Array.isArray(actions) ? actions.slice(0, 2).flatMap((item, index) => {
    const action = String(item?.action || `action-${index + 1}`).trim().replace(/[^a-z0-9_-]/gi, "").slice(0, 24);
    const actionTitle = String(item?.title || "").trim().slice(0, 20);
    if (!action || !actionTitle) return [];
    return [{
      action,
      title: actionTitle,
      ...(item.url ? { url: safeNotificationUrl(item.url, notificationType) } : {}),
    }];
  }) : [];
  const payload = {
    title: cleanTitle,
    body: cleanBody,
    url: safeUrl,
    tag: typeof tag === "string" && tag ? tag.slice(0, 64) : undefined,
    type: notificationType,
    image: safeImage === "/" && image !== "/" ? undefined : safeImage,
    actions: safeActions.length ? safeActions : undefined,
    data: { url: safeUrl },
  };
  const serialized = JSON.stringify(payload);
  return Buffer.byteLength(serialized, "utf8") <= 3072 ? serialized : null;
}

export function pickReminderMessage(now = new Date()) {
  return REMINDER_MESSAGES[now.getUTCDate() % REMINDER_MESSAGES.length];
}

function isGoneError(error) {
  return error?.statusCode === 404 || error?.statusCode === 410;
}

export function createPushService({
  supabaseUrl,
  serviceRoleKey,
  vapidPublicKey,
  vapidPrivateKey,
  vapidSubject,
  fetchImpl = fetch,
  sender = webpush,
}) {
  const storageReady = Boolean(supabaseUrl && serviceRoleKey);
  const vapidReady = Boolean(vapidPublicKey && vapidPrivateKey);
  if (vapidReady) sender.setVapidDetails(vapidSubject || "mailto:admin@example.com", vapidPublicKey, vapidPrivateKey);
  const table = `${supabaseUrl}/rest/v1/push_subscriptions`;
  const headers = (extra = {}) => ({
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  });

  async function request(url, options) {
    const response = await fetchImpl(url, options);
    if (!response.ok) throw new Error(`push_storage_${response.status}: ${await response.text()}`);
    return response;
  }

  async function select(filter) {
    const response = await request(`${table}?select=${SUBSCRIPTION_COLUMNS}&${filter}&limit=5000`, { headers: headers() });
    return response.json();
  }

  async function remove(endpoint, auth) {
    const authFilter = auth ? `&auth=eq.${encodeURIComponent(auth)}` : "";
    await request(`${table}?endpoint=eq.${encodeURIComponent(endpoint)}${authFilter}`, {
      method: "DELETE",
      headers: headers(),
    });
  }

  async function deliver(rows, payloadFor) {
    let sent = 0;
    let failed = 0;
    let removed = 0;
    const delivered = [];
    for (const row of rows) {
      try {
        await sender.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payloadFor(row),
          { TTL: 60 * 60 * 12 },
        );
        sent += 1;
        delivered.push(row);
      } catch (error) {
        if (isGoneError(error)) {
          removed += 1;
          await remove(row.endpoint).catch(() => {});
        } else {
          failed += 1;
          console.warn("[PUSH] delivery failed:", error?.statusCode || error?.message || error);
        }
      }
    }
    return { sent, failed, removed, delivered };
  }

  return {
    get configured() {
      return storageReady && vapidReady;
    },
    publicKey: vapidPublicKey || "",

    async save(subscription, { userId = null, announcements = true, remindersEnabled = false, reminderMinute = null, timezone = "UTC", userAgent = "" } = {}) {
      await request(`${table}?on_conflict=endpoint`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          user_id: userId,
          announcements: Boolean(announcements),
          reminders_enabled: Boolean(remindersEnabled),
          reminder_minute: normalizeReminderMinute(reminderMinute),
          timezone: normalizeTimezone(timezone),
          user_agent: String(userAgent || "").slice(0, 200),
          updated_at: new Date().toISOString(),
        }),
      });
    },

    remove,

    async broadcast(payload) {
      const rows = await select("announcements=is.true");
      const { sent, failed, removed } = await deliver(rows, () => payload);
      return { total: rows.length, sent, failed, removed };
    },

    // Sends one notification to a single device (used for report-status updates).
    async sendToEndpoint(endpoint, payload) {
      const rows = await select(`endpoint=eq.${encodeURIComponent(endpoint)}`);
      if (!rows.length) return { sent: 0, failed: 0, removed: 0, subscribed: false };
      const { sent, failed, removed } = await deliver(rows, () => payload);
      return { sent, failed, removed, subscribed: true };
    },

    async runReminders(now = new Date()) {
      const rows = (await select("reminders_enabled=is.true&reminder_minute=not.is.null")).filter((row) => isReminderDue(row, now));
      const message = pickReminderMessage(now);
      const payload = buildPushPayload({ ...message, url: "/", tag: "study-reminder" });
      const { sent, failed, removed, delivered } = await deliver(rows, () => payload);
      for (const row of delivered) {
        await request(`${table}?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
          method: "PATCH",
          headers: headers({ Prefer: "return=minimal" }),
          body: JSON.stringify({ last_reminded_on: localClock(now, row.timezone).day }),
        }).catch((error) => console.warn("[PUSH] reminder bookkeeping failed:", error.message));
      }
      return { due: rows.length, sent, failed, removed };
    },
  };
}
