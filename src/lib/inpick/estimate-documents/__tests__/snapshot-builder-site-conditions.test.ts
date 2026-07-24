import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEstimateDocumentPackage } from "../snapshot-builder";
import { SITE_CONDITION_DOCUMENT_SUMMARY } from "../../estimate-v2/site-condition-pricing";

test("PDF package consolidates site-condition notices into one clean assumption", () => {
  const pkg = buildEstimateDocumentPackage({
    projectId: "project-a",
    mode: "consumer_preview",
    project: {
      projectId: "project-a",
      consumerId: "user-a",
      projectName: "테스트 아파트",
      addressText: "서울특별시 테스트로 1",
      scopeSummary: "주거 인테리어",
    },
    consumer: {
      role: "consumer",
      userId: "user-a",
      displayName: "테스트 고객",
    },
    buildEstimateResult: {
      estimates: [],
      grandTotal: {
        mainTotal: 0,
        auxTotal: 0,
        laborTotal: 0,
        totalWon: 0,
      },
    },
  });

  assert.equal(
    pkg.assumptions.filter(
      (assumption) => assumption === SITE_CONDITION_DOCUMENT_SUMMARY,
    ).length,
    1,
  );
  assert.equal(
    pkg.assumptions.some((assumption) =>
      assumption.startsWith("철거 공사 금액은 기본 철거 단가"),
    ),
    false,
  );
  assert.equal(pkg.warnings.length, 0);
});
