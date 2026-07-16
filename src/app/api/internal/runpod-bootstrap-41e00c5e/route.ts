import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BOOTSTRAP_TOKEN = "41e00c5e-196b-4325-8cf4-99ed778b4c58";
const API_BASE = "https://rest.runpod.io/v1";
const TEMPLATE_NAME = "inpick-vision-materials-openclip-v1";
const ENDPOINT_NAME = "inpick-vision-materials";
const IMAGE_NAME = "ghcr.io/sanoi011/inpick-vision-materials:latest";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; action?: string };
    if (body.token !== BOOTSTRAP_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (body.action === "inspect") {
      return NextResponse.json(await inspectAccount());
    }
    if (body.action === "bootstrap") {
      return NextResponse.json(await bootstrap());
    }
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
