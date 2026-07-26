import assert from "node:assert/strict";
import test from "node:test";
import { confirmExpoDimensions } from "../footprint";
import { addExpoComponent, createExpoScene } from "../scene";
import { buildCatalogEstimate } from "../estimate";
import {
  canPublishProposal,
  isExpoProposalSnapshot,
  isProposalStale,
  type ExpoProposalSnapshot,
} from "../proposal";

const CONFIRMED = confirmExpoDimensions(
  { widthM: 6, depthM: 3, boothType: "inline", wallHeightM: 2.5 },
  "2026-07-27T00:00:00.000Z",
);

function fullyQuoted(scene = createExpoScene(6, 3)) {
  const base = buildCatalogEstimate(scene, CONFIRMED);
  const overrides = Object.fromEntries(
    base.lines.map((line) => [line.id, { unitAmountKrw: line.unitAmountKrw }]),
  );
  return buildCatalogEstimate(scene, CONFIRMED, { overrides });
}

test("publish gate demands confirmed dims and fully quoted lines", () => {
  const scene = createExpoScene(6, 3);
  const partial = buildCatalogEstimate(scene, CONFIRMED);
  assert.equal(canPublishProposal(partial, false).ok, false);
  const notQuoted = canPublishProposal(partial, true);
  assert.ok(!notQuoted.ok && notQuoted.reason === "LINES_NOT_FULLY_QUOTED");
  assert.equal(canPublishProposal(null, true).ok, false);
  assert.equal(canPublishProposal(fullyQuoted(scene), true).ok, true);
});

test("stale detection catches scene revisions and price drift", () => {
  let scene = createExpoScene(6, 3);
  const estimate = fullyQuoted(scene);
  const proposal: ExpoProposalSnapshot = {
    publishedAt: "2026-07-27T00:00:00.000Z",
    sceneRevision: scene.revision,
    estimate,
  };
  assert.ok(isExpoProposalSnapshot(proposal));
  assert.equal(isProposalStale(proposal, scene, estimate), false);

  const mutated = addExpoComponent(scene, "info_counter", "c1");
  assert.equal(isProposalStale(proposal, mutated, fullyQuoted(mutated)), true);
  assert.equal(isProposalStale(proposal, null, estimate), true);
});
