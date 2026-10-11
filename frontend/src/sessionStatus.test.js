import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sessionStatusView } from "./sessionStatus.js";

test("session status labels explain standby, listening, answering, muted, and reconnecting", () => {
  assert.deepEqual(sessionStatusView({ companionName: "Mira" }), { key: "standby", label: "Standby · say Mira or tap to ask" });
  assert.deepEqual(sessionStatusView({ asking: true }), { key: "listening", label: "Listening to you…" });
  assert.deepEqual(sessionStatusView({ speaking: true }), { key: "answering", label: "Answering…" });
  assert.deepEqual(sessionStatusView({ muted: true, status: "connected" }), { key: "muted", label: "Mic muted · tap to unmute" });
  assert.deepEqual(sessionStatusView({ status: "reconnecting (connection ended)" }), { key: "reconnecting", label: "Reconnecting…" });
});

test("connection failures and legacy voice have explicit labels", () => {
  assert.deepEqual(sessionStatusView({ status: "voice connection unavailable" }), { key: "offline", label: "Voice unavailable" });
  assert.deepEqual(sessionStatusView({ legacy: true, status: "connected" }), { key: "listening", label: "Listening to you…" });
});

test("the reading dock has one microphone control and it toggles mute", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const dock = app.split('<div className="glass-dock">')[1]?.split('<div className="sess-sidekick">')[0] || "";
  assert.equal([...dock.matchAll(/<SessionMuteButton\b[^>]*onToggle=\{toggleMute\}/g)].length, 2);
  const muteComponent = readFileSync(new URL("./SessionMuteButton.js", import.meta.url), "utf8");
  assert.match(muteComponent, /onClick: onToggle/);
  assert.match(muteComponent, /"aria-pressed": muted/);
  assert.doesNotMatch(muteComponent, /\bdisabled\b|pointer-events\s*:\s*none/);
  const css = readFileSync(new URL("./App.css", import.meta.url), "utf8");
  const muteRules = css.match(/[^{}]*\.mic-mute-btn[^{}]*\{[^{}]*\}/g) || [];
  assert.ok(muteRules.length > 0);
  assert.ok(muteRules.every((rule) => !/pointer-events\s*:\s*none/.test(rule)));
  assert.match(app, /actions=\{voiceRetryError \? \[\{ label: "Retry", onClick: retryVoiceConnection/);
  const mutedCallback = app.split("onMuted: (nextMuted) => {")[1]?.split("onStatus: (nextStatus, error) =>")[0] || "";
  assert.doesNotMatch(mutedCallback, /mutedRef\.current\s*=(?!=)/);
  assert.match(app, /toggleSessionMuteIntent\(\{/);
  assert.doesNotMatch(dock.match(/onClick=\{toggleAsk\}[^>]*>(.*?)<\/Motion\.button>/s)?.[0] || "", /<Mic(?:Off)?\b/);
  assert.match(dock, /MessageCircleMore size=\{22\}/);
});