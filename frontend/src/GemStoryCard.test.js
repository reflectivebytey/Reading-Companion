import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./GemStoryCard.jsx", import.meta.url), "utf8");

test("legacy gem card renders with the original nine color effects", () => {
  for (const effect of ["noir", "aurora", "sunset", "ocean", "forest", "rose", "mono", "vintage", "neon"]) {
    assert.match(source, new RegExp(`id: \\"${effect}\\"`));
  }
  assert.match(source, /className=\{`gsc-card \$\{styleId\}`\}/);
  assert.match(source, /STYLES\.map\(\(style\)/);
  assert.match(source, /onClick=\{download\}/);
  assert.doesNotMatch(source, /GEM_TEMPLATES|gsc-template-section|gsc-palette-row|Surprise me|aspect-toggle/);
});