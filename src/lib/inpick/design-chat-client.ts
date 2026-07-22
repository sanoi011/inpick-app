export interface DesignChatMessageLike {
  role: "user" | "assistant";
  content: string;
  images?: unknown;
}

export interface ExtractDesignPromptResult {
  room_type?: string;
  area_sqm?: number;
  style?: string;
  tone?: string;
  image_prompt: string;
  notice?: string;
}

const MAX_EXTRACTION_TEXT_CHARS = 40_000;
const MAX_MESSAGE_CHARS = 6_000;

function textOnlyMessages(messages: DesignChatMessageLike[]) {
  const selected: Array<{ role: "user" | "assistant"; content: string }> = [];
  let remaining = MAX_EXTRACTION_TEXT_CHARS;

  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (!content) continue;
    const bounded = content.slice(0, Math.min(MAX_MESSAGE_CHARS, remaining));
    selected.push({ role: message.role, content: bounded });
    remaining -= bounded.length;
  }

  return selected.reverse();
}

function invalidResponseError(response: Response, bodyText: string): Error {
  if (response.status === 413 || /request entity too large|payload too large/i.test(bodyText)) {
    return new Error("요청 데이터가 너무 큽니다. 첨부 이미지를 제외하고 다시 시도해주세요.");
  }
  return new Error(
    response.ok
      ? `상담 내용 정리 서버 응답 형식 오류 (HTTP ${response.status})`
      : `상담 내용 정리 서버 오류 (HTTP ${response.status})`,
  );
}

export async function extractDesignPrompt(
  messages: DesignChatMessageLike[],
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractDesignPromptResult> {
  const response = await fetchImpl("/api/inpick/design-chat/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: textOnlyMessages(messages) }),
  });
  const bodyText = await response.text();

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid envelope");
    }
    data = parsed as Record<string, unknown>;
  } catch {
    throw invalidResponseError(response, bodyText);
  }

  if (!response.ok || typeof data.image_prompt !== "string" || !data.image_prompt.trim()) {
    const error = typeof data.error === "string" ? data.error : "상담 내용 정리 실패";
    const hint = typeof data.hint === "string" ? ` → ${data.hint}` : "";
    throw new Error(`${error}${hint}`);
  }

  return data as unknown as ExtractDesignPromptResult;
}
