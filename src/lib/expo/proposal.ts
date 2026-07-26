import type { ExpoBoothScene } from "@/lib/expo/scene";
import type { ExpoCatalogEstimate } from "@/lib/expo/estimate";

/**
 * INPICK EXPO — 시공사 발행 제안 (contractor_proposal 단계).
 *
 * 불변조건:
 *   - 발행은 명시적 인간 행위 — 이 모듈은 게이트 검사와 스냅샷 형태만
 *     정의하고, 어떤 것도 자동 발행하지 않는다.
 *   - 발행 게이트: 치수 확정 + 모든 직접비 라인이 quoted(시공사 검토 완료).
 *   - 발행 후 씬/단가가 바뀌면 stale — 오래된 발행본을 현재인 것처럼
 *     보여주지 않는다.
 */

export interface ExpoProposalSnapshot {
  publishedAt: string;
  sceneRevision: number;
  estimate: ExpoCatalogEstimate;
}

export function isExpoProposalSnapshot(
  value: unknown,
): value is ExpoProposalSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as ExpoProposalSnapshot;
  return (
    typeof snapshot.publishedAt === "string" &&
    typeof snapshot.sceneRevision === "number" &&
    Boolean(snapshot.estimate) &&
    typeof snapshot.estimate === "object" &&
    snapshot.estimate.stage === "catalog_estimate" &&
    Array.isArray(snapshot.estimate.lines) &&
    typeof snapshot.estimate.totalKrw === "number"
  );
}

export type ExpoPublishGate =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "DIMENSIONS_NOT_CONFIRMED"
        | "ESTIMATE_MISSING"
        | "LINES_NOT_FULLY_QUOTED";
      detail: string;
    };

export function canPublishProposal(
  estimate: ExpoCatalogEstimate | null,
  dimensionsConfirmed: boolean,
): ExpoPublishGate {
  if (!dimensionsConfirmed) {
    return {
      ok: false,
      reason: "DIMENSIONS_NOT_CONFIRMED",
      detail: "치수 확정 후 발행할 수 있습니다.",
    };
  }
  if (!estimate) {
    return {
      ok: false,
      reason: "ESTIMATE_MISSING",
      detail: "견적이 계산되어야 발행할 수 있습니다.",
    };
  }
  if (estimate.quotedLineCount < estimate.directLineCount) {
    return {
      ok: false,
      reason: "LINES_NOT_FULLY_QUOTED",
      detail: `직접비 ${estimate.directLineCount}개 중 ${estimate.quotedLineCount}개만 검토됨 — 모든 라인의 단가를 검토(quoted)해야 발행됩니다.`,
    };
  }
  return { ok: true };
}

/** 발행본이 현재 상태와 어긋났는가 — 씬 리비전 또는 금액이 다르면 stale. */
export function isProposalStale(
  proposal: ExpoProposalSnapshot,
  scene: ExpoBoothScene | null,
  currentEstimate: ExpoCatalogEstimate | null,
): boolean {
  if (!scene || !currentEstimate) return true;
  if (proposal.sceneRevision !== scene.revision) return true;
  return proposal.estimate.totalKrw !== currentEstimate.totalKrw;
}
