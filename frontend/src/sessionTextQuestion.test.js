import assert from "node:assert/strict";
import test from "node:test";
import { requestTextAnswer } from "./sessionTextQuestion.js";

test("typed questions use the server text endpoint without a voice client", async () => {
  let request;
  const answer = await requestTextAnswer(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ answer: "The story says to be curious." }) };
  }, "/api/reading/ask-text", { question: "Why did the character leave?", context: "book context", image: "" });
  assert.equal(answer, "The story says to be curious.");
  assert.equal(request.url, "/api/reading/ask-text");
  assert.equal(JSON.parse(request.options.body).question, "Why did the character leave?");
});

test("typed question failures explain retry without relying on voice status", async () => {
  await assert.rejects(requestTextAnswer(async () => ({ ok: false, status: 503 }), "/api/reading/ask-text", {}), /Text answer unavailable/);
});