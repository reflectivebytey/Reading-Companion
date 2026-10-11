import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorProfiles, fetchWikipediaAuthor, NO_BIO, splitAuthorNames } from "./authorProfiles.js";

test("splits co-authors on commas, and, ampersands, and with", () => {
  assert.deepEqual(splitAuthorNames("Ichiro Kishimi and Fumitake Koga"), ["Ichiro Kishimi", "Fumitake Koga"]);
  assert.deepEqual(splitAuthorNames("A. Writer, B. Writer & C. Writer with D. Writer"), ["A. Writer", "B. Writer", "C. Writer", "D. Writer"]);
});

test("placeholder and missing author strings remain a single editable profile", () => {
  assert.deepEqual(splitAuthorNames("Editor / Publisher"), []);
  assert.deepEqual(splitAuthorNames("Multiple authors"), []);
  assert.equal(buildAuthorProfiles({ authorName: "", authorBio: "" })[0].bio, NO_BIO);
});

test("profiles reuse cached author-specific photos and bios", () => {
  const profiles = buildAuthorProfiles({
    authorName: "Ichiro Kishimi and Fumitake Koga",
    authorPortraits: [{ name: "Fumitake Koga", dataUrl: "photo", bio: "Cached bio", lookupDone: true }],
  });
  assert.equal(profiles[0].bio, NO_BIO);
  assert.equal(profiles[1].bio, "Cached bio");
  assert.equal(profiles[1].dataUrl, "photo");
  assert.equal(profiles[1].lookupDone, true);
});

test("Wikipedia fallback accepts a matching author page and rejects wrong people", async () => {
  const good = await fetchWikipediaAuthor("Fumitake Koga", async () => ({
    ok: true,
    json: async () => ({
      type: "standard", title: "Fumitake Koga", description: "Japanese writer",
      extract: "Fumitake Koga is a Japanese writer known for his collaborations and books.",
      thumbnail: { source: "https://upload.wikimedia.org/photo.jpg" },
      content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Fumitake_Koga" } },
    }),
  }));
  assert.equal(good.source, "Wikipedia");
  assert.equal(good.thumbnail, "https://upload.wikimedia.org/photo.jpg");
  const wrong = await fetchWikipediaAuthor("Fumitake Koga", async () => ({
    ok: true,
    json: async () => ({ type: "standard", title: "Another Person", description: "writer", extract: "A long enough biography for the wrong person." }),
  }));
  assert.equal(wrong, null);
});