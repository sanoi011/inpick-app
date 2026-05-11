/**
 * 업종별 zone template.
 *
 * 가이드: c:\Users\user\Downloads\inpick-commercial-editable-render-workflow-plan-20260511.md §2-1
 *
 * Step1에서 업종 선택 시 즉시 zones[] 초기화 — Step2 사이드바에 표시.
 */

import type {
  CommercialBusinessType,
  CommercialZoneSpec,
} from "@/lib/inpick/workflow/project-mode";

let zoneIdCounter = 1;
function makeZone(
  nameKo: string,
  type: CommercialZoneSpec["type"],
  priority: number,
): CommercialZoneSpec {
  return {
    id: `cz_${Date.now()}_${zoneIdCounter++}`,
    nameKo,
    type,
    priority,
  };
}

export function commercialZoneTemplates(
  businessType: CommercialBusinessType,
): CommercialZoneSpec[] {
  switch (businessType) {
    case "cafe":
      return [
        makeZone("홀", "main_hall", 1),
        makeZone("카운터", "counter", 2),
        makeZone("주방", "kitchen", 3),
        makeZone("창고", "storage", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
        makeZone("간판", "signage", 7),
      ];
    case "restaurant":
      return [
        makeZone("홀", "main_hall", 1),
        makeZone("주방", "kitchen", 2),
        makeZone("세척공간", "kitchen", 3),
        makeZone("창고", "storage", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
        makeZone("간판", "signage", 7),
      ];
    case "beauty_salon":
      return [
        makeZone("대기공간", "main_hall", 1),
        makeZone("시술공간", "treatment_room", 2),
        makeZone("샴푸공간", "treatment_room", 3),
        makeZone("수납공간", "storage", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
      ];
    case "clinic":
      return [
        makeZone("대기실", "main_hall", 1),
        makeZone("진료실", "treatment_room", 2),
        makeZone("검사실", "treatment_room", 3),
        makeZone("접수/카운터", "counter", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
      ];
    case "office":
      return [
        makeZone("오픈오피스", "office_room", 1),
        makeZone("회의실", "office_room", 2),
        makeZone("탕비실", "kitchen", 3),
        makeZone("창고", "storage", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
      ];
    case "retail":
      return [
        makeZone("매장홀", "main_hall", 1),
        makeZone("진열벽", "main_hall", 2),
        makeZone("계산대", "counter", 3),
        makeZone("창고", "storage", 4),
        makeZone("피팅룸", "fitting_room", 5),
        makeZone("파사드", "front_facade", 6),
        makeZone("간판", "signage", 7),
      ];
    case "academy":
      return [
        makeZone("강의실", "office_room", 1),
        makeZone("자습실", "office_room", 2),
        makeZone("로비", "main_hall", 3),
        makeZone("화장실", "restroom", 4),
        makeZone("파사드", "front_facade", 5),
      ];
    case "gym":
      return [
        makeZone("운동홀", "main_hall", 1),
        makeZone("탈의실", "fitting_room", 2),
        makeZone("샤워실", "restroom", 3),
        makeZone("카운터", "counter", 4),
        makeZone("창고", "storage", 5),
        makeZone("파사드", "front_facade", 6),
      ];
    case "bakery":
      return [
        makeZone("매장", "main_hall", 1),
        makeZone("진열장/카운터", "counter", 2),
        makeZone("제빵실", "kitchen", 3),
        makeZone("창고", "storage", 4),
        makeZone("파사드", "front_facade", 5),
        makeZone("간판", "signage", 6),
      ];
    case "bar":
      return [
        makeZone("홀", "main_hall", 1),
        makeZone("바카운터", "counter", 2),
        makeZone("주방", "kitchen", 3),
        makeZone("창고", "storage", 4),
        makeZone("화장실", "restroom", 5),
        makeZone("파사드", "front_facade", 6),
        makeZone("간판", "signage", 7),
      ];
    case "studio":
      return [
        makeZone("촬영공간", "main_hall", 1),
        makeZone("탈의실", "fitting_room", 2),
        makeZone("창고", "storage", 3),
        makeZone("화장실", "restroom", 4),
        makeZone("파사드", "front_facade", 5),
      ];
    default:
      return [
        makeZone("메인 공간", "main_hall", 1),
        makeZone("카운터", "counter", 2),
        makeZone("창고", "storage", 3),
        makeZone("화장실", "restroom", 4),
        makeZone("파사드", "front_facade", 5),
      ];
  }
}

/**
 * 업종별 필수 시스템 추천 (Step1 체크박스 default).
 */
export function defaultRequiredSystems(
  businessType: CommercialBusinessType,
): import("@/lib/inpick/workflow/project-mode").CommercialSystemRequirement[] {
  type Sys = import("@/lib/inpick/workflow/project-mode").CommercialSystemRequirement;
  const base: Sys[] = ["demolition", "flooring", "wall_finish", "ceiling", "lighting"];
  switch (businessType) {
    case "cafe":
    case "restaurant":
    case "bakery":
    case "bar":
      return [...base, "plumbing", "gas", "kitchen_exhaust", "hvac", "signage", "facade"];
    case "beauty_salon":
      return [...base, "plumbing", "electrical_upgrade", "hvac"];
    case "clinic":
      return [...base, "plumbing", "electrical_upgrade", "hvac", "fire_sprinkler"];
    case "retail":
      return [...base, "electrical_upgrade", "signage", "facade", "custom_millwork"];
    case "office":
    case "academy":
    case "studio":
      return [...base, "electrical_upgrade", "soundproofing", "network_cctv"];
    case "gym":
      return [...base, "plumbing", "hvac", "soundproofing"];
    default:
      return base;
  }
}
