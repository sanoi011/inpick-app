import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });

const key = process.env.GOOGLE_GEMINI_API_KEY;
console.log("API Key:", key ? `YES (${key.length} chars)` : "NO");
if (!key) { console.log("ERROR: GOOGLE_GEMINI_API_KEY not set"); process.exit(1); }

const client = new GoogleGenAI({ apiKey: key });
const models = ["gemini-3-pro-preview", "gemini-2.5-flash", "gemini-3-pro-image-preview"];

for (const model of models) {
  try {
    const r = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Say OK" }] }],
      config: { maxOutputTokens: 10 },
    });
    console.log(`✅ ${model}: ${(r.text || "").trim().substring(0, 40)}`);
  } catch (e) {
    console.log(`❌ ${model}: ${(e.message || "").substring(0, 80)}`);
  }
}
console.log("\nAll model checks complete.");
