/**
 * material_product_images.clip_embedding 채우기.
 *
 * 운영 안전 정책:
 *   - 실제 쓰기는 RunPod OpenCLIP만 허용
 *   - mock embedding은 dry-run에서만 허용
 *   - 512차원·유한값·L2 norm·모델 식별자를 검증한 뒤 저장
 *   - offset 대신 UUID cursor를 사용해 업데이트 도중 행을 건너뛰지 않음
 */
import { createClient } from "@supabase/supabase-js";

const APPROVED_MODEL = "openclip-vit-b-32-laion2b-s34b-b79k";

interface Row {
  id: string;
  image_url: string;
  material_product_id: string;
}

interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: "runpod" | "mock";
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    args[key] =
      argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  }
  return args;
}

function validEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 512) return false;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return false;
  }
  const norm = Math.sqrt(value.reduce((sum, item) => sum + item * item, 0));
  return norm >= 0.95 && norm <= 1.05;
}

function normalizeRunPodEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "").replace(/\/runsync$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://api.runpod.ai/v2/${trimmed}`;
}

async function embedBatchViaRunPod(
  rows: Row[],
): Promise<Map<string, EmbeddingResult>> {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_VISION_MATERIALS_ENDPOINT;
  const results = new Map<string, EmbeddingResult>();
  if (!apiKey || !endpoint || rows.length === 0) return results;
  const runsyncUrl = `${normalizeRunPodEndpoint(endpoint)}/runsync`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(runsyncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: {
            mode: "batch_embed",
            image_urls: rows.map((row) => row.image_url),
          },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        output?: {
          items?: Array<{ image_url?: string; embedding?: unknown; error?: string | null }>;
          model?: string;
          error?: string;
        };
        error?: string;
      };
      const output = payload.output;
      if (output?.error || payload.error) {
        throw new Error(output?.error || payload.error);
      }
      if (output?.model !== APPROVED_MODEL || !Array.isArray(output.items)) {
        throw new Error(`invalid batch payload (model=${output?.model || "missing"})`);
      }
      for (let index = 0; index < rows.length; index++) {
        const item = output.items[index];
        if (!item || item.error || !validEmbedding(item.embedding)) continue;
        results.set(rows[index].id, {
          embedding: item.embedding,
          model: APPROVED_MODEL,
          provider: "runpod",
        });
      }
      return results;
    } catch (error) {
      if (attempt === 2) {
        console.warn(
          `[embed-mpi] RunPod batch 실패 (${rows.length}개): ${error instanceof Error ? error.message : error}`,
        );
        return results;
      }
    }
  }
  return results;
}

function mockEmbedding(imageUrl: string): EmbeddingResult {
  let hash = 0;
  for (let i = 0; i < imageUrl.length; i++) {
    hash = (hash << 5) - hash + imageUrl.charCodeAt(i);
    hash |= 0;
  }
  const values = Array.from({ length: 512 }, (_, index) => {
    const seed = (Math.abs(hash) + index) % 1000;
    return (seed - 500) / 500;
  });
  const norm = Math.sqrt(values.reduce((sum, item) => sum + item * item, 0));
  return {
    embedding: values.map((item) => item / norm),
    model: "mock-dry-run-only",
    provider: "mock",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dry === "true" || args.write !== "true";
  const batchSize = Math.min(24, Math.max(1, parseInt(args.batchSize || "24", 10)));
  const limit = Math.max(0, parseInt(args.limit || "0", 10));
  const provider = (args.provider || "auto").toLowerCase();
  if (!["auto", "runpod", "mock"].includes(provider)) {
    throw new Error(`지원하지 않는 provider: ${provider}`);
  }

  const hasRunPod = Boolean(
    process.env.RUNPOD_API_KEY && process.env.RUNPOD_VISION_MATERIALS_ENDPOINT,
  );
  const useRunPod = provider === "runpod" || (provider === "auto" && hasRunPod);
  if (!dryRun && !useRunPod) {
    throw new Error(
      "운영 embedding 쓰기는 RUNPOD_API_KEY와 RUNPOD_VISION_MATERIALS_ENDPOINT가 필요합니다.",
    );
  }
  if (!dryRun && provider === "mock") {
    throw new Error("mock embedding은 DB에 저장할 수 없습니다.");
  }
  if (provider === "runpod" && !hasRunPod) {
    throw new Error("RunPod 환경변수가 설정되지 않았습니다.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수 미설정");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `[embed-mpi] mode=${dryRun ? "DRY-RUN" : "WRITE"} ` +
      `provider=${useRunPod ? "runpod" : "mock"} batchSize=${batchSize} limit=${limit || "none"}`,
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let cursor = args.afterId || "";

  while (limit === 0 || processed < limit) {
    const take = Math.min(batchSize, limit > 0 ? limit - processed : batchSize);
    let query = admin
      .from("material_product_images")
      .select("id, image_url, material_product_id")
      .is("clip_embedding", null)
      .order("id", { ascending: true })
      .limit(take);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw new Error(`이미지 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;

    const rows = data as Row[];
    const batchResults = useRunPod
      ? await embedBatchViaRunPod(rows)
      : new Map(rows.map((row) => [row.id, mockEmbedding(row.image_url)]));

    for (const row of rows) {
      cursor = row.id;
      const result = batchResults.get(row.id);
      processed++;
      if (!result || !validEmbedding(result.embedding)) {
        failed++;
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await admin
          .from("material_product_images")
          .update({
            clip_embedding: result.embedding,
            embedding_model: result.model,
            embedding_provider: result.provider,
            embedded_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .is("clip_embedding", null);
        if (updateError) {
          console.warn(`  fail ${row.id}: ${updateError.message}`);
          failed++;
          continue;
        }
      }
      succeeded++;
    }
    console.log(
      `  progress: processed=${processed}, succeeded=${succeeded}, failed=${failed}, cursor=${cursor}`,
    );
    if (data.length < take) break;
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "DRY-RUN" : "WRITE",
        provider: useRunPod ? "runpod" : "mock",
        model: useRunPod ? APPROVED_MODEL : "mock-dry-run-only",
        processed,
        succeeded,
        failed,
        cursor,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[embed-mpi] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
