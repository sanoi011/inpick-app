/**
 * 견적서 문서 번호 생성.
 * 예: INP-QT-20260511-AB12CD-V01
 */
import type { EstimateDocumentMode } from "./types";

const MODE_PREFIX: Record<EstimateDocumentMode, string> = {
  consumer_preview: "QT",
  contractor_bid: "BD",
  matched_contract: "CT",
};

export function createEstimateDocumentNo(input: {
  projectId: string;
  mode: EstimateDocumentMode;
  version: number;
  date?: Date;
}): string {
  const d = input.date || new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = MODE_PREFIX[input.mode] || "QT";
  // projectId 8자리 short (UUID 앞)
  const pid = input.projectId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const ver = `V${String(input.version).padStart(2, "0")}`;
  return `INP-${prefix}-${yyyymmdd}-${pid}-${ver}`;
}
