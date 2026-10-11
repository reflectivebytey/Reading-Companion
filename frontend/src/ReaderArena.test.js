import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("weekly rank tags render only the rank number", () => {
  const arena = readFileSync(new URL("./ReaderArena.jsx", import.meta.url), "utf8");
  assert.match(arena, /<span className="arena-row-rank">\{`#\$\{reader\.rank \?\? "–"\}`\}/);
  assert.doesNotMatch(arena, /arena-row-rank[^\n]*this week/);
});
