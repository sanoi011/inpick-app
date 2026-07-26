import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyEventInfo,
  evaluateEventRules,
  hasEventRuleInput,
  hasEventRuleViolation,
  isExpoEventInfo,
} from "../event-rules";

test("empty info has no input, no review items", () => {
  const info = createEmptyEventInfo();
  assert.ok(!hasEventRuleInput(info));
  assert.deepEqual(evaluateEventRules(info, 2.5), []);
  assert.ok(isExpoEventInfo(info));
});

test("height over the entered limit is a violation, under is ok", () => {
  const info = { ...createEmptyEventInfo(), maxHeightM: 2.5 };
  const over = evaluateEventRules(info, 3);
  assert.equal(over[0].code, "height_limit");
  assert.equal(over[0].severity, "violation");
  assert.ok(hasEventRuleViolation(over));
  assert.ok(over[0].message.includes("사용자 입력"));

  const under = evaluateEventRules(info, 2.5);
  assert.equal(under[0].severity, "ok");
  assert.ok(!hasEventRuleViolation(under));
});

test("power below the costbook base assumption warns without blocking", () => {
  const info = { ...createEmptyEventInfo(), powerKw: 0.5 };
  const items = evaluateEventRules(info, null);
  assert.equal(items[0].code, "power_capacity");
  assert.equal(items[0].severity, "warning");
  assert.ok(!hasEventRuleViolation(items));
});

test("any entered field counts as rule input", () => {
  assert.ok(hasEventRuleInput({ ...createEmptyEventInfo(), boothNumber: "A-102" }));
  assert.ok(hasEventRuleInput({ ...createEmptyEventInfo(), powerKw: 3 }));
  assert.ok(!isExpoEventInfo({ eventName: 1 }));
});
