import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { accountCopyDecision, collectLocalReaderSnapshot, hasLocalReaderData, localReaderCacheBelongsToAnotherAccount, readerSnapshotSignature, restoreLocalReaderSnapshot } from "./accountSync.js";

function makeStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
  };
}
beforeEach(() => { globalThis.localStorage = makeStorage(); });
afterEach(() => { delete globalThis.localStorage; });

test("collects only reader data and includes per-book conversation cache", () => {
  localStorage.setItem("reading_companion_profile", JSON.stringify({ name: "Reader", hasCompletedOnboarding: true }));
  localStorage.setItem("reading_companion_library", JSON.stringify({ books: { book: { id: "book" } } }));
  localStorage.setItem("rc_convo_book", JSON.stringify([{ s: "reader", t: "Hello" }]));
  localStorage.setItem("rc_last_version", "1.6.0");
  localStorage.setItem("rc_gem_pair_echoes_v1", "{}");
  const snapshot = collectLocalReaderSnapshot();
  assert.ok(snapshot.data.reading_companion_profile);
  assert.ok(snapshot.data.rc_convo_book);
  assert.equal(snapshot.data.rc_last_version, undefined);
  assert.equal(snapshot.data.rc_gem_pair_echoes_v1, undefined);
  assert.equal(hasLocalReaderData(snapshot), true);
});

test("restores the selected snapshot without deleting reports or sync metadata", () => {
  localStorage.setItem("rc_convo_old", "[]");
  localStorage.setItem("rc_reports", "[]");
  localStorage.setItem("rc_account_sync_meta", "{}");
  const snapshot = { version: 1, data: { "reading_companion_profile": "{\"name\":\"Soumya\"}", "rc_convo_new": "[]" } };
  restoreLocalReaderSnapshot(snapshot);
  assert.equal(localStorage.getItem("reading_companion_profile"), "{\"name\":\"Soumya\"}");
  assert.equal(localStorage.getItem("rc_convo_old"), null);
  assert.equal(localStorage.getItem("rc_convo_new"), "[]");
  assert.equal(localStorage.getItem("rc_reports"), "[]");
  assert.equal(localStorage.getItem("rc_account_sync_meta"), "{}");
  assert.equal(readerSnapshotSignature(snapshot), readerSnapshotSignature(snapshot));
});

test("cloud memory restore replaces the local snapshot instead of appending another copy", () => {
  localStorage.setItem("reading_companion_memory", JSON.stringify([{ text: "I prefer quiet evenings." }]));
  restoreLocalReaderSnapshot({
    version: 1,
    data: { reading_companion_memory: JSON.stringify([{ text: "I prefer quiet evenings." }]) },
  });
  assert.deepEqual(JSON.parse(localStorage.getItem("reading_companion_memory")), [{ text: "I prefer quiet evenings." }]);
});

test("an empty new reader snapshot does not trigger a migration prompt", () => {
  assert.equal(hasLocalReaderData({ version: 1, data: {} }), false);
});

test("only an unclaimed or matching-account cache is eligible for import", () => {
  assert.equal(localReaderCacheBelongsToAnotherAccount("account-b", { userId: "account-a" }), true);
  assert.equal(localReaderCacheBelongsToAnotherAccount("account-a", { userId: "account-a" }), false);
  assert.equal(localReaderCacheBelongsToAnotherAccount("account-b", null), false);
});

test("account copy selection avoids silent cross-device overwrites", () => {
  const base = { version: 1, data: { reading_companion_profile: "reader" } };
  const deviceChange = { version: 1, data: { reading_companion_profile: "device" } };
  const cloudChange = { version: 1, data: { reading_companion_profile: "cloud" } };
  const signature = readerSnapshotSignature(base);
  assert.equal(accountCopyDecision({ userId: "u1", meta: null, localSnapshot: deviceChange, remoteSnapshot: cloudChange }), "conflict");
  assert.equal(accountCopyDecision({ userId: "u1", meta: { userId: "u1", signature }, localSnapshot: base, remoteSnapshot: base }), "same");
  assert.equal(accountCopyDecision({ userId: "u1", meta: { userId: "u1", signature }, localSnapshot: base, remoteSnapshot: cloudChange }), "cloud");
  assert.equal(accountCopyDecision({ userId: "u1", meta: { userId: "u1", signature }, localSnapshot: deviceChange, remoteSnapshot: base }), "device");
});

test("a cloud copy with reordered keys is recognised as unchanged", () => {
  const local = { version: 1, data: { reading_companion_profile: "p", reading_companion_library: "l", rc_convo_1: "c" } };
  const cloud = { version: 1, data: { rc_convo_1: "c", reading_companion_library: "l", reading_companion_profile: "p" } };
  assert.equal(readerSnapshotSignature(local), readerSnapshotSignature(cloud));
  const meta = { userId: "u1", signature: readerSnapshotSignature(local) };
  const edited = { version: 1, data: { ...local.data, rc_convo_2: "new" } };
  assert.equal(accountCopyDecision({ userId: "u1", meta, localSnapshot: edited, remoteSnapshot: cloud }), "device");
});

test("a new cloud account starts from the local snapshot", () => {
  const localSnapshot = { version: 1, data: { reading_companion_profile: "reader" } };
  assert.equal(accountCopyDecision({ userId: "u1", meta: null, localSnapshot, remoteSnapshot: null }), "device");
});
