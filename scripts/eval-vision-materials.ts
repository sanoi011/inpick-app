/**
 * Vision Materials eval harness (Phase 8 scaffold).
 *
 * 가이드: docs/vision-materials/EVALUATION_PROTOCOL.md
 *
 * 사용:
 *   npx tsx scripts/eval-vision-materials.ts \
 *     --dataset gold-v1 \
 *     --runId vm-2026-05-11 \
 *     --out reports/vision-materials/run-2026-05-11.jsonl
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface CaseRow {
  id: string;
  dataset_name: string;
  image_url: string;
  expected_surfaces: unknown[];
  expected_materials?: unknown;
  expected_products?: { material_product_id: string }[];
}

interface Metrics {
  totalCandidates: number;
  hallucinatedSkuCount: number;
  hallucinatedSkuRate: number;
  topMatchedCount: number;
  // 향후 추가: mAP, mIoU, top-k accuracy, etc.
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const DATASET = args.dataset || "gold-v1";
const RUN_ID = args.runId || `vm-${new Date().toISOString().slice(0, 10)}`;
const OUT_PATH =
  args.out || `reports/vision-materials/run-${new Date().toISOString().slice(0, 10)}.jsonl`;
const BASE_URL = args.url || process.env.EVAL_BASE_URL || "http://localhost:3000";

async function loadCases(): Promise<CaseRow[]> {
  if (args.fromFile) {
    return JSON.parse(fs.readFileSync(args.fromFile, "utf8")) as CaseRow[];
  }
  // Supabase에서 직접 로드 (server-side)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "[eval-vm] Supabase 환경변수 미설정 — --fromFile path/to/cases.json 권장",
    );
    return [];
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("vision_eval_cases")
    .select("*")
    .eq("dataset_name", DATASET)
    .eq("split", "test");
  if (error) {
    console.error("[eval-vm] cases load error:", error.message);
    return [];
  }
  return (data || []) as unknown as CaseRow[];
}

async function runCase(c: CaseRow): Promise<{
  caseId: string;
  metrics: Metrics;
  output: unknown;
  error?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/api/inpick/vision-materials/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: `eval-${c.id}`,
        imageUrl: c.image_url,
        sourceImageKind: "user_photo",
      }),
    });
    if (!res.ok) {
      return {
        caseId: c.id,
        metrics: {
          totalCandidates: 0,
          hallucinatedSkuCount: 0,
          hallucinatedSkuRate: 0,
          topMatchedCount: 0,
        },
        output: null,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      observations: Array<{
        candidates: Array<{ materialProductId: string }>;
      }>;
    };
    const candidates = data.observations.flatMap((o) => o.candidates);
    const totalCandidates = candidates.length;

    // hallucinated SKU 검증 — Phase 8 후속에서 DB 조회로 정확화
    // 현재는 placeholder (UUID 형식 검증만)
    let hallucinatedCount = 0;
    for (const c of candidates) {
      if (
        !c.materialProductId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          c.materialProductId,
        )
      ) {
        hallucinatedCount++;
      }
    }
    const expected = (c.expected_products || []).map((p) => p.material_product_id);
    const topMatchedCount = candidates.filter((cand) =>
      expected.includes(cand.materialProductId),
    ).length;

    return {
      caseId: c.id,
      metrics: {
        totalCandidates,
        hallucinatedSkuCount: hallucinatedCount,
        hallucinatedSkuRate:
          totalCandidates > 0 ? hallucinatedCount / totalCandidates : 0,
        topMatchedCount,
      },
      output: data,
    };
  } catch (e) {
    return {
      caseId: c.id,
      metrics: {
        totalCandidates: 0,
        hallucinatedSkuCount: 0,
        hallucinatedSkuRate: 0,
        topMatchedCount: 0,
      },
      output: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const cases = await loadCases();
  console.log(`[eval-vm] dataset=${DATASET} cases=${cases.length} runId=${RUN_ID}`);
  if (cases.length === 0) {
    console.log("[eval-vm] cases 0건 — vision_eval_cases에 gold dataset 추가 필요");
    return;
  }

  const out = fs.createWriteStream(OUT_PATH, { flags: "a" });
  let total = { totalCandidates: 0, hallucinated: 0, topMatched: 0 };
  for (const c of cases) {
    const r = await runCase(c);
    out.write(
      JSON.stringify({
        runId: RUN_ID,
        ...r,
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
    total.totalCandidates += r.metrics.totalCandidates;
    total.hallucinated += r.metrics.hallucinatedSkuCount;
    total.topMatched += r.metrics.topMatchedCount;
    console.log(
      `  ${c.id}: candidates=${r.metrics.totalCandidates} hallucinated=${r.metrics.hallucinatedSkuCount} matched=${r.metrics.topMatchedCount}`,
    );
  }
  out.end();
  console.log(`[eval-vm] DONE → ${OUT_PATH}`);
  console.log("Aggregate metrics:");
  console.log(
    `  totalCandidates: ${total.totalCandidates}, hallucinated: ${total.hallucinated}, hallucinatedRate: ${
      total.totalCandidates > 0
        ? ((total.hallucinated / total.totalCandidates) * 100).toFixed(2)
        : 0
    }%, topMatched: ${total.topMatched}`,
  );
  console.log(
    "출시 게이트: hallucinatedRate=0% + high-confidence precision>=90%",
  );
}

main().catch((e) => {
  console.error("[eval-vm] fatal:", e);
  process.exit(1);
});
