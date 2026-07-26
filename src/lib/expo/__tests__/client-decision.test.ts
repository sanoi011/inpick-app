import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPO_DECISION_COMMENT_MAX,
  isExpoClientDecision,
} from "../client-decision";

test("client decision guard validates kind and comment bounds", () => {
  const base = {
    decision: "approved" as const,
    comment: "",
    decidedAt: "2026-07-27T00:00:00.000Z",
  };
  assert.ok(isExpoClientDecision(base));
  assert.ok(isExpoClientDecision({ ...base, decision: "changes_requested", comment: "로고 크게" }));
  assert.ok(!isExpoClientDecision({ ...base, decision: "maybe" }));
  assert.ok(!isExpoClientDecision({ ...base, comment: "a".repeat(EXPO_DECISION_COMMENT_MAX + 1) }));
  assert.ok(!isExpoClientDecision(null));
});
