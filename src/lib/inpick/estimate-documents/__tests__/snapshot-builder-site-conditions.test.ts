import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEstimateDocumentPackage } from "../snapshot-builder";
import { SITE_CONDITION_DOCUMENT_SUMMARY } from "../../estimate-v2/site-condition-pricing";
import type { DetailLine } from "../../../estimate-pro/detail-model";

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

test("PDF package uses the material option rows currently shown in the estimate", () => {
  const detailLine: DetailLine = {
    id: "ceiling-option",
    trade: "도장공사",
    order: 15,
    itemCode: "09-03",
    itemName: "천장 친환경 수성 도장",
    part: "천장",
    spec: "친환경 수성페인트 무광 2회",
    brand: "맞춤형",
    product: "친환경 수성페인트",
    unit: "m²",
    quantity: 24,
    matUnit: 7_000,
    labUnit: 14_000,
    expenseUnit: 800,
    matAmount: 168_000,
    labAmount: 336_000,
    expenseAmount: 19_200,
    amount: 523_200,
    room: "거실",
    source: "사용자 견적 옵션",
    optional: false,
    added: false,
    materialOptionId: "ceiling-water-paint",
  };
  const pkg = buildEstimateDocumentPackage({
    projectId: "project-option",
    mode: "consumer_preview",
    project: {
      projectId: "project-option",
      consumerId: "user-option",
      projectName: "옵션 견적",
      addressText: "서울특별시 테스트로 2",
      scopeSummary: "주거 인테리어",
    },
    consumer: {
      role: "consumer",
      userId: "user-option",
      displayName: "테스트 고객",
    },
    detailLines: [detailLine],
  });

  assert.equal(pkg.lines.length, 1);
  assert.equal(pkg.lines[0].itemName, "천장 친환경 수성 도장");
  assert.equal(pkg.lines[0].brand, "맞춤형");
  assert.equal(pkg.summary.materialAmount, 168_000);
  assert.equal(pkg.summary.laborAmount, 336_000);
  assert.equal(pkg.summary.expenseAmount, 19_200);
});
