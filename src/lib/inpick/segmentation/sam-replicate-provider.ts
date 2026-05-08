/**
 * SAM 2.1 via Replicate.com — 가이드 §3 "Meta SAM 2.1, 영역 분할 글로벌 표준"
 *
 * 흐름:
 *   1) Replicate POST /v1/predictions with model "meta/sam-2"
 *   2) polling /v1/predictions/{id} until status=succeeded
 *   3) 결과: combined_mask URL + individual_masks URLs[]
 *   4) 각 individual_mask 다운로드 → marching-squares로 contour tracing → polygon
 *   5) GPT-4o Vision으로 카테고리 일괄 분류
 *
 * 환경변수: REPLICATE_API_TOKEN (필수, "r8_..." 형식)
 *
 * 참고:
 *   - https://replicate.com/meta/sam-2
 *   - 무료 tier 일정량, 그 이후 ~$0.0011/image
 *   - 한 번 호출에 평균 5~15초 (모델 cold start 포함)
 */
import {
  INTERIOR_CATEGORIES,
  REPLACEABLE_CATEGORIES,
  FURNITURE_CATEGORIES,
  type InteriorCategory,
  type SegRegion,
  type SegmentationData,
} from "@/types/segmentation";
import { analyzeImageVision } from "../openai-client";
import type { SegmentationProvider, SegmentInput } from "./provider";

const REPLICATE_BASE = "https://api.replicate.com/v1";
const SAM2_VERSION =
  // meta/sam-2 latest version hash. 변경되면 https://replicate.com/meta/sam-2/versions 에서 갱신.
  process.env.SAM2_VERSION ||
  "fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc1b";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: {
    combined_mask?: string;
    individual_masks?: string[];
  };
  error?: string;
}

async function callReplicate(input: SegmentInput): Promise<ReplicatePrediction> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN 미설정");

  const start = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: SAM2_VERSION,
      input: {
        image: input.imageUrl,
        // SAM 2 자동 마스크 생성 모드 — 가이드 §1-2의 SAM2AutomaticMaskGenerator와 동등 옵션
        points_per_side: 16,
        pred_iou_thresh: 0.86,
        stability_score_thresh: 0.92,
        min_mask_region_area: 5000,
        use_m2m: true,
      },
    }),
  });
  if (!start.ok) {
    const t = await start.text();
    throw new Error(`Replicate start failed ${start.status}: ${t.slice(0, 200)}`);
  }
  const created = (await start.json()) as ReplicatePrediction;

  // poll
  const deadline = Date.now() + 240_000; // 4분
  let pred: ReplicatePrediction = created;
  while (pred.status === "starting" || pred.status === "processing") {
    if (Date.now() > deadline) throw new Error("SAM 2 Replicate timeout (240s)");
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!poll.ok) {
      const t = await poll.text();
      throw new Error(`Replicate poll failed ${poll.status}: ${t.slice(0, 200)}`);
    }
    pred = (await poll.json()) as ReplicatePrediction;
  }
  if (pred.status !== "succeeded") {
    throw new Error(`SAM 2 Replicate ${pred.status}: ${pred.error || "unknown"}`);
  }
  return pred;
}

/**
 * 마스크 PNG → polygon. 단순 marching-squares.
 * Vercel serverless에서 sharp를 통한 raw pixel 접근.
 */
async function maskToPolygon(
  maskUrl: string,
): Promise<{ polygon: [number, number][]; bbox: [number, number, number, number]; areaN: number } | null> {
  const r = await fetch(maskUrl);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  // sharp는 Vercel runtime에 기본 포함
  const sharpMod: typeof import("sharp") = (await import("sharp")).default || (await import("sharp"));
  const img = sharpMod(buf).greyscale();
  const meta = await img.metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });

  // bbox + 면적
  let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
  const threshold = 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (v >= threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }
  if (count === 0) return null;
  const areaN = count / (w * h);
  if (areaN < 0.005) return null; // 0.5% 미만 스킵

  // 외곽 contour — 단순 boundary tracing
  // Moore-neighbor variant: foreground 첫 픽셀부터 시계 방향 추적
  const polygon = traceBoundary(data, w, h, threshold, minX, minY);
  if (polygon.length < 3) return null;

  // 단순화 (Douglas-Peucker)
  const epsilon = Math.max(2, Math.min(w, h) * 0.005);
  const simplified = douglasPeucker(polygon, epsilon);

  // 정규화
  const norm: [number, number][] = simplified.map(([x, y]) => [x / w, y / h]);
  const bbox: [number, number, number, number] = [
    minX / w,
    minY / h,
    (maxX - minX) / w,
    (maxY - minY) / h,
  ];

  return { polygon: norm, bbox, areaN };
}

function traceBoundary(
  data: Buffer,
  w: number,
  h: number,
  threshold: number,
  startX: number,
  startY: number,
): [number, number][] {
  // 첫 foreground 픽셀 찾기 (top-left)
  let sx = -1, sy = -1;
  outer: for (let y = startY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] >= threshold) {
        sx = x;
        sy = y;
        break outer;
      }
    }
  }
  if (sx < 0) return [];

  // 8-방향 (시계)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  const points: [number, number][] = [];
  let cx = sx, cy = sy;
  let dir = 0;
  let safety = 0;
  do {
    points.push([cx, cy]);
    if (++safety > w * h) break; // overflow guard
    let found = false;
    for (let k = 0; k < 8; k++) {
      const ndir = (dir + 6 + k) & 7; // turn -90 then scan CW
      const nx = cx + dx[ndir];
      const ny = cy + dy[ndir];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && data[ny * w + nx] >= threshold) {
        cx = nx;
        cy = ny;
        dir = ndir;
        found = true;
        break;
      }
    }
    if (!found) break;
  } while (!(cx === sx && cy === sy));

  return points;
}

function douglasPeucker(
  pts: [number, number][],
  epsilon: number,
): [number, number][] {
  if (pts.length < 3) return pts;
  const out: [number, number][] = [];
  const stack: [number, number][] = [[0, pts.length - 1]];
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;

  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx]);
      stack.push([idx, e]);
    }
  }
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function perpDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** GPT-4o Vision으로 polygon들 일괄 카테고리 분류 (CLIP 대체) */
async function classifyRegionsBulk(
  imageUrl: string,
  regions: { id: string; bbox: [number, number, number, number] }[],
): Promise<Map<string, { category: InteriorCategory; confidence: number; guessed_material?: string; guessed_color_hex?: string }>> {
  if (regions.length === 0) return new Map();

  const desc = regions
    .map((r) => `- ${r.id} bbox=[${r.bbox.map((v) => v.toFixed(3)).join(",")}]`)
    .join("\n");
  const prompt = `이 인테리어 사진의 영역들을 분류하세요. 각 영역은 정규화 bbox로 주어집니다.

영역들:
${desc}

각 영역에 대해 JSON 응답:
{
  "results": [
    {
      "id": "region_001",
      "category": "floor|wall|ceiling|window|door|curtain|sofa|chair|table|bed|cabinet|lighting|plant|rug|artwork|unknown",
      "confidence": 0.0~1.0,
      "guessed_material": "현재 자재 추정 (예: 오크 원목마루, 화이트 페인트)",
      "guessed_color_hex": "#RRGGBB"
    }
  ]
}

규칙: confidence 0.3 미만이면 category="unknown". 작은 소품/책은 unknown.`;

  const visionRes = await analyzeImageVision({
    imageUrl,
    prompt,
    responseFormat: "json_object",
  });

  type ClsResult = { id: string; category: string; confidence?: number; guessed_material?: string; guessed_color_hex?: string };
  let parsed: { results?: ClsResult[] };
  try {
    parsed = JSON.parse(visionRes.content);
  } catch {
    return new Map();
  }
  const map = new Map<string, { category: InteriorCategory; confidence: number; guessed_material?: string; guessed_color_hex?: string }>();
  for (const r of parsed.results || []) {
    const cat = (r.category && r.category in INTERIOR_CATEGORIES ? r.category : "unknown") as InteriorCategory;
    const conf = typeof r.confidence === "number" ? r.confidence : 0.5;
    map.set(r.id, {
      category: conf < 0.3 ? "unknown" : cat,
      confidence: conf,
      guessed_material: r.guessed_material,
      guessed_color_hex: r.guessed_color_hex,
    });
  }
  return map;
}

export const samReplicateProvider: SegmentationProvider = {
  name: "sam-2.1",
  async segment(input: SegmentInput): Promise<SegmentationData> {
    if (!input.imageUrl) throw new Error("SAM 2 provider 는 imageUrl 필수 (Replicate가 URL 다운로드)");

    const pred = await callReplicate(input);
    const masks = pred.output?.individual_masks || [];
    if (masks.length === 0) throw new Error("SAM 2 응답에 individual_masks 없음");

    // 각 mask → polygon 변환 (병렬, 단 동시 sharp 사용 12개 한도)
    const concurrency = 6;
    const rawRegions: Array<{
      id: string;
      polygon: [number, number][];
      bbox: [number, number, number, number];
      areaN: number;
    }> = [];

    for (let i = 0; i < masks.length; i += concurrency) {
      const slice = masks.slice(i, i + concurrency);
      const out = await Promise.all(slice.map((m) => maskToPolygon(m).catch(() => null)));
      out.forEach((res, j) => {
        if (!res) return;
        const idx = i + j;
        rawRegions.push({
          id: `region_${String(idx).padStart(3, "0")}`,
          polygon: res.polygon,
          bbox: res.bbox,
          areaN: res.areaN,
        });
      });
    }

    if (rawRegions.length === 0) throw new Error("SAM 2 출력에서 유효 영역 0개");

    // 카테고리 분류 (GPT-4o 일괄, ~$0.01)
    const classMap = await classifyRegionsBulk(input.imageUrl, rawRegions);

    const regions: SegRegion[] = rawRegions.map((rr) => {
      const cls = classMap.get(rr.id) || { category: "unknown" as InteriorCategory, confidence: 0.3 };
      return {
        id: rr.id,
        category: cls.category,
        label_ko: INTERIOR_CATEGORIES[cls.category],
        polygon: rr.polygon,
        bbox: rr.bbox,
        confidence: cls.confidence,
        is_replaceable: REPLACEABLE_CATEGORIES.has(cls.category),
        is_furniture: FURNITURE_CATEGORIES.has(cls.category),
        current_material: null,
        current_material_sku: null,
        area_normalized: rr.areaN,
        guessed_material: cls.guessed_material,
        guessed_color_hex: cls.guessed_color_hex,
      };
    });

    // pixel→sqm
    let pixel_to_sqm_ratio: number | undefined;
    if (input.realWorldAreaSqm && input.realWorldAreaSqm > 0) {
      const totalReplaceableN = regions
        .filter((r) => r.is_replaceable)
        .reduce((s, r) => s + r.area_normalized, 0);
      if (totalReplaceableN > 0) {
        pixel_to_sqm_ratio = input.realWorldAreaSqm / totalReplaceableN;
        for (const r of regions) {
          r.area_sqm = Math.round(r.area_normalized * pixel_to_sqm_ratio * 100) / 100;
        }
      }
    }

    return {
      image_id: `img_${Date.now().toString(36)}`,
      image_url: input.imageUrl,
      image_size: [1024, 1024], // SAM이 별도 size 안 줌 — 마스크 metadata에서 추출 가능하나 충분히 1024 표준
      real_world_area_sqm: input.realWorldAreaSqm,
      pixel_to_sqm_ratio,
      total_regions: regions.length,
      regions,
      provider: "sam-2.1",
      created_at: new Date().toISOString(),
    };
  },
};
