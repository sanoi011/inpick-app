import OpenAI from "openai";

let instance: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key.length > 10;
}

export function getOpenAIClient(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;
  if (!instance) {
    instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return instance;
}
