import assert from "node:assert/strict";
import test from "node:test";
import { reportsForOwner } from "./reportOwnership.js";

test("report lists contain only rows owned by the signed-in reader", () => {
  const rows = [
    { id: "mine", owner_user_id: "reader-a" },
    { id: "theirs", ownerUserId: "reader-b" },
    { id: "ownerless" },
  ];
  assert.deepEqual(reportsForOwner(rows, "reader-a").map((row) => row.id), ["mine"]);
  assert.deepEqual(reportsForOwner(rows, null), []);
});