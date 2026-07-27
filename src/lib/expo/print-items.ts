import type { ExpoBoothScene } from "@/lib/expo/scene";

/**
 * INPICK EXPO — 인쇄물 (확정 플로우 4·5단계).
 *
 * 불변조건:
 *   - 인쇄물 목록은 씬의 벽/사이니지 요소에서 파생된다 — 씬이 truth.
 *   - 항목 확정은 사용자의 행위(체크)로만 이뤄진다.
 *   - 생성 아트워크는 "시안"이며 인쇄 발주 원본이 아니다 (UI 상시 표기).
 */

export type ExpoPrintKind = "graphic_wall" | "lightbox_panel" | "signage_tower";

export const EXPO_PRINT_KIND_LABELS: Record<ExpoPrintKind, string> = {
  graphic_wall: "백월 그래픽",
  lightbox_panel: "라이트박스 그래픽",
  signage_tower: "사이니지 그래픽",
};

/** 인쇄물 아트워크 생성 비율 — 실제 실물 비율에 맞춘 방향 */
export const EXPO_PRINT_SIZES: Record<ExpoPrintKind, "1536x1024" | "1024x1536"> = {
  graphic_wall: "1536x1024",
  lightbox_panel: "1024x1536",
  signage_tower: "1024x1536",
};

export interface ExpoPrintItem {
  /** 씬 컴포넌트 id와 1:1 연계 */
  id: string;
  kind: ExpoPrintKind;
  label: string;
  note: string;
  refImageUrl: string | null;
  artworkUrl: string | null;
  confirmed: boolean;
}

export function isExpoPrintItems(value: unknown): value is ExpoPrintItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ExpoPrintItem).id === "string" &&
      (item as ExpoPrintItem).kind in EXPO_PRINT_KIND_LABELS &&
      typeof (item as ExpoPrintItem).note === "string" &&
      typeof (item as ExpoPrintItem).confirmed === "boolean",
  );
}

/**
 * 씬에서 인쇄물 목록 파생 — 기존 항목의 메모/첨부/아트워크/확정은 id로
 * 유지하고, 씬에서 사라진 컴포넌트의 항목은 제거한다.
 */
export function derivePrintItems(
  scene: ExpoBoothScene | null,
  existing: ExpoPrintItem[],
): ExpoPrintItem[] {
  if (!scene) return [];
  const byId = new Map(existing.map((item) => [item.id, item]));
  const items: ExpoPrintItem[] = [];
  const counters: Record<string, number> = {};
  for (const component of scene.components) {
    if (!(component.catalogId in EXPO_PRINT_KIND_LABELS)) continue;
    const kind = component.catalogId as ExpoPrintKind;
    counters[kind] = (counters[kind] ?? 0) + 1;
    const kept = byId.get(component.id);
    items.push(
      kept ?? {
        id: component.id,
        kind,
        label: `${EXPO_PRINT_KIND_LABELS[kind]} ${counters[kind]}`,
        note: "",
        refImageUrl: null,
        artworkUrl: null,
        confirmed: false,
      },
    );
  }
  return items;
}

export function allPrintsConfirmed(items: ExpoPrintItem[]): boolean {
  return items.length > 0 && items.every((item) => item.confirmed);
}
