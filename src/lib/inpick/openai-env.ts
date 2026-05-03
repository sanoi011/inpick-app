/**
 * OpenAI API 키 환경변수 헬퍼.
 * Vercel에 소문자(openai_api_key)로 등록된 경우도 호환.
 */

export function getOpenAIKey(): string | undefined {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.openai_api_key ||
    process.env.OPENAI_KEY ||
    undefined
  );
}

export function hasOpenAIKey(): boolean {
  return !!getOpenAIKey();
}
