import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const apiKey = process.env.RUNPOD_API_KEY;
const endpointId =
  process.env.RUNPOD_SAM31_ENDPOINT_ID || process.env.RUNPOD_SAM3_ENDPOINT_ID;
const shouldWarmup = process.argv.includes("--warmup");

if (!apiKey || !endpointId) {
  console.error(
    "RUNPOD_API_KEY와 RUNPOD_SAM31_ENDPOINT_ID를 .env.local 또는 실행 환경에 등록하세요.",
  );
  process.exit(1);
}

const endpoint = `https://api.runpod.ai/v2/${endpointId}`;

async function runTask(task, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${endpoint}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { task } }),
      signal: controller.signal,
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!response.ok || body.status === "FAILED" || body.output?.error) {
      throw new Error(
        `${task} 실패 (${response.status}): ${JSON.stringify(body).slice(0, 1200)}`,
      );
    }
    console.log(
      JSON.stringify(
        {
          task,
          elapsed_ms: Date.now() - startedAt,
          status: body.status,
          output: body.output,
        },
        null,
        2,
      ),
    );
  } finally {
    clearTimeout(timeout);
  }
}

await runTask("health", 60_000);
if (shouldWarmup) {
  await runTask("warmup", 300_000);
}
