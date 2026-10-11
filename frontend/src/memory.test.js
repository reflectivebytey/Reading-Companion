import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";
import { CompanionMemory } from "./memory.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

beforeEach(() => {
  globalThis.localStorage = createStorage();
});

test("a repeated save request is ignored and paraphrases stay deduplicated", () => {
  const memory = new CompanionMemory();
  assert.equal(memory.upsert("I prefer quiet evenings with tea.", { requestId: "req-1" }).duplicate, false);
  assert.equal(memory.upsert("I prefer quiet evenings with tea.", { requestId: "req-1" }).duplicate, true);
  assert.equal(memory.add("I like quiet evenings and tea more than noise.", { requestId: "req-2" }), true);
  assert.equal(memory.memories.length, 1);
  assert.match(memory.memories[0].text, /quiet evenings/i);
});

test("new memories still save when they are genuinely different", () => {
  const memory = new CompanionMemory();
  memory.add("I prefer morning walks.", { requestId: "req-3" });
  memory.add("My favourite books are historical fiction.", { requestId: "req-4" });
  assert.equal(memory.memories.length, 2);
});

test("negated and positive preferences are not collapsed as paraphrases", () => {
  const memory = new CompanionMemory();
  memory.add("I like tea.", { requestId: "req-positive" });
  memory.add("I do not like tea.", { requestId: "req-negative" });
  assert.equal(memory.memories.length, 2);
});

test("Hinglish memory requests are normalized and not duplicated", () => {
  const memory = new CompanionMemory();
  assert.equal(memory.add("Mujhe shaam ko thoda quiet rehna pasand hai.", { requestId: "req-5" }), true);
  assert.equal(memory.add("Sham ko quiet rehna mujhe pasand hai.", { requestId: "req-6" }), true);
  assert.equal(memory.memories.length, 1);
});

test("an explicit voice memory has one writer and returns already-saved for duplicate tool results", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /\/api\/rephrase-memory/);
  assert.match(app, /memoryStore\.upsert\(fact, \{ requestId: `tool-memory:/);
  assert.match(app, /status: "already_saved"/);
});
