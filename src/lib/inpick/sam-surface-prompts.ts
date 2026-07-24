export const SAM_SURFACE_TARGETS = {
  floor: {
    labelKo: "바닥",
    concept:
      "visible floor finish surface only, excluding rugs, furniture, walls, baseboards, thresholds and doors",
  },
  wall: {
    labelKo: "벽",
    concept:
      "visible wall finish surface only, excluding windows, doors, trim, baseboards, ceiling, furniture and artwork",
  },
  ceiling: {
    labelKo: "천장",
    concept:
      "visible ceiling finish surface only, excluding walls, crown molding, lighting fixtures, vents and windows",
  },
  window: {
    labelKo: "창문",
    concept:
      "window glazing and window frame only, excluding wall, curtains, blinds and surrounding trim",
  },
  door: {
    labelKo: "문",
    concept:
      "door leaf and door frame only, excluding adjacent wall, baseboard, floor and furniture",
  },
  curtain: {
    labelKo: "커튼",
    concept:
      "curtain or blind fabric only, excluding window, wall, curtain rail and surrounding furniture",
  },
  tile_wall: {
    labelKo: "벽 타일",
    concept:
      "visible wall tile finish only, excluding floor tile, sanitary fixtures, mirrors, doors and ceiling",
  },
  cabinet: {
    labelKo: "수납장",
    concept:
      "the clicked cabinet body and door fronts only, excluding wall, countertop, appliances and adjacent cabinets",
  },
  counter: {
    labelKo: "상판",
    concept:
      "the visible countertop slab only, excluding backsplash, sink, faucet, cabinet fronts and appliances",
  },
  fixture: {
    labelKo: "설비·기기",
    concept:
      "the clicked sanitary fixture, faucet, appliance or hardware object only, excluding adjacent finishes and furniture",
  },
  lighting: {
    labelKo: "조명",
    concept:
      "the clicked lighting fixture only, excluding ceiling, surrounding trim and reflected light",
  },
} as const;

export type SamSurfaceTarget = keyof typeof SAM_SURFACE_TARGETS;

export function isSamSurfaceTarget(value: unknown): value is SamSurfaceTarget {
  return typeof value === "string" && value in SAM_SURFACE_TARGETS;
}

export function getSamSurfaceConcept(target: SamSurfaceTarget): string {
  return SAM_SURFACE_TARGETS[target].concept;
}
