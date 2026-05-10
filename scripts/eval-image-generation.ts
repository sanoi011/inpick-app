/**
 * Eval harness — image generation 비교 (Phase 7).
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
 *        Prompt 7 (Evaluation harness)
 *
 * 목적:
 *  - 같은 prompt + seed에 대해 여러 mode를 동시에 호출해서 결과 비교
 *  - JSONL/CSV로 저장 → 사람이 1~5점으로 평가
 *  - flat baseline (A) vs geometry proxy (B) 가 baseline보다 정말 나아지는지 검증
 *
 * 모드 (env IMAGE_GEN_BACKEND + IMAGE_GEN_MODE 조합으로 호출):
 *  - openai_edit: 기존 OpenAI EDITS API (현재 production)
 *  - flat_canny: RunPod backend + ControlSpec.useFloorplanCanny (baseline)
 *  - geometry_proxy: RunPod backend + ControlSpec.usePerspectiveCanny+depth+seg
 *  - geometry_proxy_lora: 위 + InPick LoRA (Phase 8 이후)
 *
 * 사용:
 *   # test cases를 reports/eval-runs/test-cases.json에 작성
 *   npx tsx scripts/eval-image-generation.ts \
 *     --cases reports/eval-runs/test-cases.json \
 *     --modes openai_edit,flat_canny,geometry_proxy \
 *     --out reports/eval-runs/run-2026-05-10.jsonl
 *
 * 결과 평가 (사람):
 *   reports/eval-runs/run-XXX.jsonl 열어서 각 row에:
 *     geometry_score / openings_score / perspective_score / usability_score
 *     / style_score / editability_score / notes
 *   채워넣고 다시 저장 → 보고서로 변환 (별도 스크립트).
 */
import * as fs from "node:fs";
import * as path from "node:path";

// ─── 타입 ───
type EvalMode =
  | "openai_edit"
  | "flat_canny"
  | "geometry_proxy"
  | "geometry_proxy_lora";

interface TestCase {
  /** 고유 ID (run간 동일하게 유지 — diff 비교용) */
  caseId: string;
  /** 사람이 알아볼 라벨 */
  label?: string;
  roomName: string;
  prompt: string;
  /** 평면도 (URL 또는 propertyId) */
  floorplanImageUrl?: string;
  propertyId?: string;
  /** 방 치수 */
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  /** 도면 인식 결과 (geometry_proxy 모드에서 사용) */
  roomGeometry?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  /** 동일 비교용 seed (모드 간 동일하게 사용) */
  seed?: number;
  steps?: number;
  guidance?: number;
  /** 추가 프롬프트 옵션 */
  stylePreset?: string;
  windows?: number;
  doors?: number;
  windowWalls?: string[];
  doorWalls?: string[];
  /** 평가 메모 (사전) */
  expectedNotes?: string;
}

interface EvalRunResult {
  // identification
  caseId: string;
  label?: string;
  mode: EvalMode;
  // request
  modelId?: string;
  seed?: number;
  prompt: string;
  // response (성공)
  status: "completed" | "queued" | "failed" | "skipped";
  imageUrl?: string;
  jobId?: string;
  backend?: string;
  costUsd?: number;
  elapsedMs?: number;
  controlMode?: string;
  // response (실패)
  error?: string;
  hint?: string;
  // 메타
  startedAt: string;
  finishedAt?: string;
  // 평가 (사람이 채움 — 1~5)
  geometry_score?: number;
  openings_score?: number;
  perspective_score?: number;
  usability_score?: number;
  style_score?: number;
  editability_score?: number;
  notes?: string;
}

// ─── CLI args ───
function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const CASES_PATH =
  args.cases || "reports/eval-runs/test-cases.json";
const MODES = (args.modes || "openai_edit,flat_canny,geometry_proxy").split(
  ",",
) as EvalMode[];
const OUT_PATH =
  args.out || `reports/eval-runs/run-${new Date().toISOString().slice(0, 10)}.jsonl`;
const BASE_URL = args.url || process.env.EVAL_BASE_URL || "http://localhost:3000";
const DRY_RUN = args.dry === "true";
const TIMEOUT_MS = parseInt(args.timeout || "300000", 10); // 5분 default

// ─── 모드별 호출 설정 ───
function modeToConfig(mode: EvalMode): {
  backend: "openai" | "runpod" | "auto";
  control: Record<string, unknown> | undefined;
  loraName?: string;
  loraScale?: number;
} {
  switch (mode) {
    case "openai_edit":
      return { backend: "openai", control: undefined };
    case "flat_canny":
      return {
        backend: "runpod",
        control: {
          useFloorplanCanny: true,
          controlStrength: 0.5,
          isBaseline: true,
        },
      };
    case "geometry_proxy":
      return {
        backend: "runpod",
        control: {
          usePerspectiveCanny: true,
          useDepth: true,
          useSegmentation: true,
          useWallMask: false,
          useFloorMask: false,
          controlStrength: 0.65,
          isBaseline: false,
        },
      };
    case "geometry_proxy_lora":
      return {
        backend: "runpod",
        control: {
          usePerspectiveCanny: true,
          useDepth: true,
          useSegmentation: true,
          controlStrength: 0.65,
        },
        loraName: "inpick-style-v1",
        loraScale: 0.6,
      };
  }
}

// ─── 단일 호출 ───
async function runOnce(
  tc: TestCase,
  mode: EvalMode,
): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const cfg = modeToConfig(mode);
  // env override (서버 측 디스패치) — 이 스크립트는 하나의 host를 hit한다고 가정.
  // 실서비스에서는 backend/control을 query로 받지 않으므로 아래는 안내용 placeholder.
  // 실제로 mode를 강제하려면 별도 endpoint나 env 분리 필요.
  // (Phase 7 minimal — 현재는 bodyparam으로 backend hint만 전달)

  const body: Record<string, unknown> = {
    roomName: tc.roomName,
    prompt: tc.prompt,
    style: tc.prompt,
    floorplanImageUrl: tc.floorplanImageUrl,
    propertyId: tc.propertyId,
    widthMm: tc.widthMm,
    depthMm: tc.depthMm,
    heightMm: tc.heightMm,
    seed: tc.seed,
    steps: tc.steps,
    guidance: tc.guidance,
    stylePreset: tc.stylePreset,
    windows: tc.windows,
    doors: tc.doors,
    windowWalls: tc.windowWalls,
    doorWalls: tc.doorWalls,
    roomGeometry: tc.roomGeometry,
    camera: tc.camera,
    // mode hint — 서버가 인지하면 사용
    _evalMode: mode,
    _evalBackend: cfg.backend,
    _evalControl: cfg.control,
    _evalLora: cfg.loraName ? { name: cfg.loraName, scale: cfg.loraScale } : undefined,
  };

  if (DRY_RUN) {
    return {
      caseId: tc.caseId,
      label: tc.label,
      mode,
      seed: tc.seed,
      prompt: tc.prompt,
      status: "skipped",
      controlMode: cfg.backend === "openai" ? "openai_edit" : "control_image",
      startedAt,
      finishedAt: new Date().toISOString(),
      notes: "DRY_RUN — not sent",
    };
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}/api/inpick/render-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        caseId: tc.caseId,
        label: tc.label,
        mode,
        seed: tc.seed,
        prompt: tc.prompt,
        status: "failed",
        error: (data.error as string) || `HTTP ${res.status}`,
        hint: data.hint as string | undefined,
        modelId: data.model as string | undefined,
        backend: data.backend as string | undefined,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
    return {
      caseId: tc.caseId,
      label: tc.label,
      mode,
      seed: tc.seed,
      prompt: tc.prompt,
      status: (data.jobId && !data.imageUrl ? "queued" : "completed") as
        | "completed"
        | "queued",
      imageUrl: data.imageUrl as string | undefined,
      jobId: data.jobId as string | undefined,
      modelId: data.model as string | undefined,
      backend: data.backend as string | undefined,
      costUsd: data.costUsd as number | undefined,
      elapsedMs: data.elapsedMs as number | undefined,
      controlMode: cfg.backend === "openai" ? "openai_edit" : "control_image",
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      caseId: tc.caseId,
      label: tc.label,
      mode,
      seed: tc.seed,
      prompt: tc.prompt,
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

// ─── main ───
async function main() {
  // 출력 디렉토리
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  // test cases 로드
  if (!fs.existsSync(CASES_PATH)) {
    console.error(`[eval] test cases 파일 없음: ${CASES_PATH}`);
    console.error(`샘플 작성 (writeSample 옵션 사용):`);
    console.error(
      `  npx tsx scripts/eval-image-generation.ts --writeSample ${CASES_PATH}`,
    );
    if (args.writeSample) {
      writeSampleCases(args.writeSample);
      console.log(`[eval] 샘플 작성: ${args.writeSample}`);
    }
    process.exit(1);
  }
  const cases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8")) as TestCase[];

  console.log(`[eval] ${cases.length} cases × ${MODES.length} modes`);
  console.log(`[eval] base URL: ${BASE_URL}`);
  console.log(`[eval] output: ${OUT_PATH}${DRY_RUN ? " (DRY)" : ""}`);

  const out = fs.createWriteStream(OUT_PATH, { flags: "a" });
  let n = 0;
  for (const tc of cases) {
    for (const mode of MODES) {
      const t0 = Date.now();
      console.log(`[eval] ${tc.caseId} | ${mode} (seed=${tc.seed})`);
      const result = await runOnce(tc, mode);
      const wallMs = Date.now() - t0;
      out.write(JSON.stringify({ ...result, wallMs }) + "\n");
      n++;
      if (result.status === "failed") {
        console.warn(`  ✗ failed: ${result.error}`);
      } else if (result.status === "completed") {
        console.log(`  ✓ completed in ${result.elapsedMs}ms — ${result.imageUrl?.slice(0, 80)}...`);
      } else {
        console.log(`  ⋯ ${result.status}`);
      }
    }
  }
  out.end();
  console.log(`[eval] done — ${n} runs → ${OUT_PATH}`);
  console.log(
    `[eval] 다음: 각 row에 geometry_score/openings_score/... 채우고 reports/eval-runs/summary.ts로 집계`,
  );
}

// ─── 샘플 test-cases 작성 ───
function writeSampleCases(targetPath: string) {
  const sample: TestCase[] = [
    {
      caseId: "eval_001_living_basic",
      label: "거실 기본 (25m² 정사각형)",
      roomName: "거실",
      prompt:
        "bright modern Korean apartment living room, white walls, warm oak floor, natural light from large window",
      widthMm: 5000,
      depthMm: 5000,
      heightMm: 2400,
      windows: 1,
      windowWalls: ["south"],
      doors: 1,
      doorWalls: ["west"],
      seed: 12345,
      steps: 24,
      guidance: 3.5,
      expectedNotes:
        "정사각형 거실. 남쪽 창 하나, 서쪽 문 하나. baseline vs proxy 비교용",
    },
    {
      caseId: "eval_002_bedroom_long",
      label: "안방 긴 직사각형 (3x4m)",
      roomName: "안방",
      prompt:
        "Korean apartment master bedroom, soft warm light, beige wallpaper, wood flooring",
      widthMm: 3000,
      depthMm: 4000,
      heightMm: 2400,
      windows: 1,
      windowWalls: ["east"],
      doors: 1,
      doorWalls: ["south"],
      seed: 12345,
      steps: 24,
      guidance: 3.5,
      expectedNotes: "긴 직사각형 — perspective 차이 잘 보임",
    },
    {
      caseId: "eval_003_kitchen_l",
      label: "주방 (4x3m)",
      roomName: "주방",
      prompt:
        "modern Korean kitchen, white upper cabinets, dark stone countertop, oak floor",
      widthMm: 4000,
      depthMm: 3000,
      heightMm: 2400,
      windows: 1,
      windowWalls: ["north"],
      doors: 1,
      doorWalls: ["south"],
      seed: 12345,
      steps: 24,
      guidance: 3.5,
    },
  ];
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(sample, null, 2), "utf8");
}

if (args.writeSample) {
  writeSampleCases(args.writeSample);
  console.log(`[eval] sample written: ${args.writeSample}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[eval] fatal:", e);
  process.exit(1);
});
