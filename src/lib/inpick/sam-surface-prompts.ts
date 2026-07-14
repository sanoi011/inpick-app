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
} as const;

export type SamSurfaceTarget = keyof typeof SAM_SURFACE_TARGETS;

export function isSamSurfaceTarget(value: unknown): value is SamSurfaceTarget {
  return typeof value === "string" && value in SAM_SURFACE_TARGETS;
}

export function getSamSurfaceConcept(target: SamSurfaceTarget): string {
  return SAM_SURFACE_TARGETS[target].concept;
}
