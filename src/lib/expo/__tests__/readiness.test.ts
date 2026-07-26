import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProposalReadiness,
  readinessPercent,
} from "../readiness";

function stateOf(
  items: ReturnType<typeof evaluateProposalReadiness>,
  dimension: string,
) {
  const item = items.find((i) => i.dimension === dimension);
  assert.ok(item, `dimension missing: ${dimension}`);
  return item.state;
}

test("empty brief starts everything unstarted", () => {
  const items = evaluateProposalReadiness({
    hasFootprint: false,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: null,
  });
  assert.equal(items.length, 7);
  assert.ok(items.every((item) => item.state === "unstarted"));
  assert.ok(items.every((item) => item.detail.length > 0));
  assert.equal(readinessPercent(items), 0);
});

test("footprint promotes space and price to assumed, never confirmed", () => {
  const items = evaluateProposalReadiness({
    hasFootprint: true,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: "conceptual_range",
  });
  assert.equal(stateOf(items, "space"), "assumed");
  assert.equal(stateOf(items, "price"), "assumed");
  assert.equal(stateOf(items, "configuration"), "unstarted");
});

test("confirmed dimensions make space confirmed but price stays assumed", () => {
  const items = evaluateProposalReadiness({
    hasFootprint: true,
    dimensionsConfirmed: true,
    componentCount: 3,
    priceStage: "catalog_estimate",
  });
  assert.equal(stateOf(items, "space"), "confirmed");
  assert.equal(stateOf(items, "price"), "assumed");
  assert.equal(stateOf(items, "configuration"), "assumed");
  const config = items.find((i) => i.dimension === "configuration");
  assert.ok(config?.detail.includes("3개"));
});

test("percent reflects mixed states and full pipeline is below 100 in v1", () => {
  const items = evaluateProposalReadiness({
    hasFootprint: true,
    dimensionsConfirmed: true,
    componentCount: 1,
    priceStage: "catalog_estimate",
  });
  const percent = readinessPercent(items);
  assert.ok(percent > 0 && percent < 100);
});

test("brand confirms only through the user's rights-confirmed kit", () => {
  const without = evaluateProposalReadiness({
    hasFootprint: true,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: "conceptual_range",
  });
  assert.equal(stateOf(without, "brand"), "unstarted");
  const withBrand = evaluateProposalReadiness({
    hasFootprint: true,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: "conceptual_range",
    brandConfirmed: true,
  });
  assert.equal(stateOf(withBrand, "brand"), "confirmed");
});

test("event rules confirm on input and block on violation", () => {
  const base = {
    hasFootprint: true,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: "conceptual_range" as const,
  };
  assert.equal(stateOf(evaluateProposalReadiness(base), "event_rules"), "unstarted");
  assert.equal(
    stateOf(
      evaluateProposalReadiness({ ...base, eventRules: { entered: true, violation: false } }),
      "event_rules",
    ),
    "confirmed",
  );
  assert.equal(
    stateOf(
      evaluateProposalReadiness({ ...base, eventRules: { entered: true, violation: true } }),
      "event_rules",
    ),
    "blocked",
  );
});

test("client decision drives the last readiness dimension", () => {
  const base = {
    hasFootprint: true,
    dimensionsConfirmed: true,
    componentCount: 1,
    priceStage: "catalog_estimate" as const,
  };
  assert.equal(stateOf(evaluateProposalReadiness(base), "client_decision"), "unstarted");
  assert.equal(
    stateOf(evaluateProposalReadiness({ ...base, clientDecision: "approved" }), "client_decision"),
    "confirmed",
  );
  assert.equal(
    stateOf(
      evaluateProposalReadiness({ ...base, clientDecision: "changes_requested" }),
      "client_decision",
    ),
    "needs_review",
  );
});

test("official services confirm on self-checked input", () => {
  const base = {
    hasFootprint: true,
    dimensionsConfirmed: false,
    componentCount: 0,
    priceStage: null,
  };
  assert.equal(stateOf(evaluateProposalReadiness(base), "official_services"), "unstarted");
  assert.equal(
    stateOf(
      evaluateProposalReadiness({ ...base, officialServicesEntered: true }),
      "official_services",
    ),
    "confirmed",
  );
});
