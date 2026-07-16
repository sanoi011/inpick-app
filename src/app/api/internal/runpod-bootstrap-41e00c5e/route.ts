import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BOOTSTRAP_TOKEN = "41e00c5e-196b-4325-8cf4-99ed778b4c58";
const API_BASE = "https://rest.runpod.io/v1";
const TEMPLATE_NAME = "inpick-vision-materials-openclip-v1";
const ENDPOINT_NAME = "inpick-vision-materials";
const IMAGE_NAME = "ghcr.io/sanoi011/inpick-vision-materials:latest";
const APPROVED_MODEL = "openclip-vit-b-32-laion2b-s34b-b79k";

interface RunPodTemplate {
  id: string;
  name?: string;
  imageName?: string;
  isServerless?: boolean;
  containerRegistryAuthId?: string | null;
}

interface RunPodEndpoint {
  id: string;
  name?: string;
  templateId?: string;
  workersMin?: number;
  workersMax?: number;
  idleTimeout?: number;
  gpuTypeIds?: string[];
  template?: RunPodTemplate;
}

async function runPod<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error("RUNPOD_API_KEY missing in Vercel runtime");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`RunPod ${response.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

function safeTemplate(template: RunPodTemplate) {
  return {
    id: template.id,
    name: template.name,
    imageName: template.imageName,
    isServerless: template.isServerless,
    hasRegistryAuth: Boolean(template.containerRegistryAuthId),
  };
}

function safeEndpoint(endpoint: RunPodEndpoint) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    templateId: endpoint.templateId || endpoint.template?.id,
    workersMin: endpoint.workersMin,
    workersMax: endpoint.workersMax,
    idleTimeout: endpoint.idleTimeout,
    gpuTypeIds: endpoint.gpuTypeIds,
    template: endpoint.template ? safeTemplate(endpoint.template) : undefined,
  };
}

async function inspectAccount() {
  const [endpoints, templates] = await Promise.all([
    runPod<RunPodEndpoint[]>("/endpoints?includeTemplate=true&includeWorkers=true"),
    runPod<RunPodTemplate[]>("/templates?includeEndpointBoundTemplates=true"),
  ]);
  return {
    endpoints: endpoints.map(safeEndpoint),
    templates: templates.map(safeTemplate),
  };
}

async function bootstrap() {
  const existing = await inspectAccount();
  let template = existing.templates.find(
    (item) => item.name === TEMPLATE_NAME || item.imageName === IMAGE_NAME,
  );
  let createdTemplate = false;

  if (!template) {
    const registryTemplate = existing.templates.find(
      (item) => item.hasRegistryAuth && item.imageName?.includes("ghcr.io/sanoi011/"),
    );
    const created = await runPod<RunPodTemplate>("/templates", {
      method: "POST",
      body: JSON.stringify({
        imageName: IMAGE_NAME,
        name: TEMPLATE_NAME,
        category: "NVIDIA",
        containerDiskInGb: 20,
        ...(registryTemplate?.hasRegistryAuth
          ? {
              containerRegistryAuthId: (
                await runPod<RunPodTemplate[]>(
                  "/templates?includeEndpointBoundTemplates=true",
                )
              ).find((item) => item.id === registryTemplate.id)?.containerRegistryAuthId,
            }
          : {}),
        dockerEntrypoint: [],
        dockerStartCmd: [],
        env: {
          VISION_MATERIALS_LOAD_MODELS: "true",
          VISION_MATERIALS_ENABLE_OCR: "false",
          VISION_MATERIALS_MAX_BATCH: "24",
        },
        isPublic: false,
        isServerless: true,
        ports: [],
        readme: "InPick OpenCLIP image and detected-region embedding worker",
        volumeInGb: 0,
        volumeMountPath: "/workspace",
      }),
    });
    template = safeTemplate(created);
    createdTemplate = true;
  }

  let endpoint = existing.endpoints.find(
    (item) => item.name === ENDPOINT_NAME || item.templateId === template?.id,
  );
  let createdEndpoint = false;
  if (!endpoint && template) {
    const created = await runPod<RunPodEndpoint>("/endpoints", {
      method: "POST",
      body: JSON.stringify({
        templateId: template.id,
        allowedCudaVersions: ["12.1", "12.2", "12.3", "12.4", "12.5", "12.6"],
        computeType: "GPU",
        executionTimeoutMs: 600000,
        flashboot: true,
        gpuCount: 1,
        gpuTypeIds: [
          "NVIDIA RTX A4000",
          "NVIDIA RTX A4500",
          "NVIDIA RTX A5000",
          "NVIDIA GeForce RTX 3090",
          "NVIDIA GeForce RTX 4090",
        ],
        idleTimeout: 5,
        minCudaVersion: "12.1",
        name: ENDPOINT_NAME,
        scalerType: "QUEUE_DELAY",
        scalerValue: 2,
        workersMax: 1,
        workersMin: 0,
      }),
    });
    endpoint = safeEndpoint(created);
    createdEndpoint = true;
  }

  return {
    template,
    endpoint,
    endpointBaseUrl: endpoint ? `https://api.runpod.ai/v2/${endpoint.id}` : null,
    createdTemplate,
    createdEndpoint,
  };
}

function validEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 512) return false;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return false;
  }
  const norm = Math.sqrt(value.reduce((sum, item) => sum + item * item, 0));
  return norm >= 0.95 && norm <= 1.05;
}

async function callWorker(endpointId: string, input: Record<string, unknown>) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error("RUNPOD_API_KEY missing in Vercel runtime");
  if (!/^[a-z0-9]+$/i.test(endpointId)) throw new Error("invalid endpointId");
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(280_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Worker ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as {
    status?: string;
    error?: string;
    output?: Record<string, unknown>;
  };
}

async function smokeWorker(endpointId: string) {
  const result = await callWorker(endpointId, { mode: "health" });
  return { status: result.status, output: result.output, error: result.error };
}

async function embedNextBatch(endpointId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase admin env missing");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("material_product_images")
    .select("id, image_url")
    .is("clip_embedding", null)
    .order("id", { ascending: true })
    .limit(24);
  if (error) throw new Error(`image query failed: ${error.message}`);
  const rows = (data || []) as Array<{ id: string; image_url: string }>;
  if (rows.length === 0) return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };

  const worker = await callWorker(endpointId, {
    mode: "batch_embed",
    image_urls: rows.map((row) => row.image_url),
  });
  const output = worker.output as
    | {
        model?: string;
        items?: Array<{ embedding?: unknown; error?: string | null }>;
      }
    | undefined;
  if (worker.error || output?.model !== APPROVED_MODEL || !Array.isArray(output.items)) {
    throw new Error(
      worker.error || `invalid worker output model=${output?.model || "missing"}`,
    );
  }

  let succeeded = 0;
  let failed = 0;
  for (let index = 0; index < rows.length; index++) {
    const item = output.items[index];
    if (!item || item.error || !validEmbedding(item.embedding)) {
      failed++;
      continue;
    }
    const { error: updateError } = await admin
      .from("material_product_images")
      .update({
        clip_embedding: item.embedding,
        embedding_model: APPROVED_MODEL,
        embedding_provider: "runpod",
        embedded_at: new Date().toISOString(),
      })
      .eq("id", rows[index].id)
      .is("clip_embedding", null);
    if (updateError) failed++;
    else succeeded++;
  }
  const { count } = await admin
    .from("material_product_images")
    .select("id", { count: "exact", head: true })
    .is("clip_embedding", null);
  return {
    processed: rows.length,
    succeeded,
    failed,
    remaining: count ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      action?: string;
      endpointId?: string;
    };
    if (body.token !== BOOTSTRAP_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (body.action === "inspect") {
      return NextResponse.json(await inspectAccount());
    }
    if (body.action === "bootstrap") {
      return NextResponse.json(await bootstrap());
    }
    if (body.action === "smoke" && body.endpointId) {
      return NextResponse.json(await smokeWorker(body.endpointId));
    }
    if (body.action === "embed_batch" && body.endpointId) {
      return NextResponse.json(await embedNextBatch(body.endpointId));
    }
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
