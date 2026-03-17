import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: "" + process.env.GOOGLE_GEMINI_API_KEY + "" });

const models = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.5-flash-image",
];

for (const model of models) {
  console.log(`\n=== ${model} ===`);
  try {
    const res = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Generate a simple small white square image, 100x100 pixels" }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    });
    const parts = res.candidates?.[0]?.content?.parts || [];
    let hasImage = false;
    for (const p of parts) {
      if (p.inlineData) {
        hasImage = true;
        console.log(`  IMAGE: ${p.inlineData.mimeType}, ${p.inlineData.data.length} base64 chars`);
      }
      if (p.text) console.log(`  TEXT: ${p.text.slice(0, 100)}`);
    }
    if (!hasImage) console.log("  NO IMAGE in response");
  } catch (e) {
    console.log(`  ERROR: ${e.message.slice(0, 300)}`);
  }
}
