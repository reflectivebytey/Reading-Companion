import assert from "node:assert/strict";
import test from "node:test";
import { runSessionCleanup, runSessionTeardown } from "./sessionCleanup.js";

const states = ["standby", "listening", "answering", "muted under 30s", "muted over 30s", "voice unavailable", "reconnecting", "connecting"];

for (const state of states) {
  for (const hasSnapshot of [false, true]) {
    test(`ending from ${state} ${hasSnapshot ? "with" : "without"} a page snapshot completes navigation`, async () => {
      const failures = [];
      let screen = "session";
      const cleanup = [["audio", async () => { if (state === "muted over 30s") throw new Error("already released"); }]];
      if (hasSnapshot) cleanup.push(["snapshot", () => { screen = "session"; }]);
      cleanup.push(["navigation", () => { screen = "library"; }]);
      await assert.doesNotReject(runSessionCleanup(cleanup, (label, error) => failures.push([label, error.message])));
      assert.equal(screen, "library");
      if (state === "muted over 30s") assert.deepEqual(failures, [["audio", "already released"]]);
      else assert.deepEqual(failures, []);
    });
  }
}

test("unmount teardown continues when resources were already closed by End session", async () => {
  const completed = [];
  const failures = [];
  runSessionTeardown([
    ["Live", () => { throw new Error("already closed"); }],
    ["playback", () => Promise.reject(new Error("already closed"))],
    ["microphone", () => completed.push("microphone")],
    ["camera", () => completed.push("camera")],
  ], (label, error) => failures.push([label, error.message]));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(completed, ["microphone", "camera"]);
  assert.deepEqual(failures, [["Live", "already closed"], ["playback", "already closed"]]);
});