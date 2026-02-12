import { GoogleGenAI } from "@google/genai";

let instance: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  return !!key && key.length > 10;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (!instance) {
    instance = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });
  }
  return instance;
}
