import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("root, frontend, lockfile, app fallback, and latest release versions match", () => {
  const rootPackage = readJson("../../package.json");
  const frontendPackage = readJson("../package.json");
  const lock = readJson("../../package-lock.json");
  const releases = readJson("../public/release-notes.json").releases;
  const source = readFileSync(new URL("./version.js", import.meta.url), "utf8");
  const versions = [rootPackage.version, frontendPackage.version, lock.packages[""].version, lock.packages.frontend.version];
  assert.deepEqual(versions, ["2.6.0", "2.6.0", "2.6.0", "2.6.0"]);
  assert.match(source, /\? "2\.6\.0" : __APP_VERSION__/);
  assert.equal(releases[0].version, "2.6.0");
});

test("Steady Pages highlights cover all requested items and fit a push body", () => {
  const release = readJson("../public/release-notes.json").releases[0];
  assert.equal(release.title, "Steady Pages");
  assert.equal(release.date, "2026-10-11");
  assert.ok(release.items.length >= 6 && release.items.length <= 8);
  assert.ok(release.items.every((item) => item.text.trim().split(/\s+/).length < 12));
  assert.ok(release.items.slice(0, 3).map((item) => item.text).join(" · ").length <= 120);
});

test("release notification images are static PNGs with the required banner ratio", () => {
  const banner = readFileSync(new URL("../public/release-2.6.0-banner.png", import.meta.url));
  const badge = readFileSync(new URL("../public/notification-badge.png", import.meta.url));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(banner.subarray(0, 8), signature);
  assert.equal(banner.readUInt32BE(16) / banner.readUInt32BE(20), 2);
  assert.deepEqual(badge.subarray(0, 8), signature);
  assert.match(readFileSync(new URL("../../README.md", import.meta.url), "utf8"), /Version 2\.6\.0: Steady Pages/);
});