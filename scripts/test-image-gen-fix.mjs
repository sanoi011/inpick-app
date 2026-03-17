import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const client = new GoogleGenAI({ apiKey: "AIzaSyB6t6lpQBYp_V9tSZ49YnYPbJo5Hzddcs0" });

// Test 1: Text-to-image (like generate-image route)
console.log("=== Test 1: text-to-image ===");
try {
  const res = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: "Generate a modern white living room interior photo, professional architectural photography" }] }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });
  const parts = res.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.inlineData) console.log(`  IMAGE OK: ${p.inlineData.mimeType}, ${Math.round(p.inlineData.data.length/1024)}KB base64`);
    if (p.text) console.log(`  TEXT: ${p.text.slice(0, 100)}`);
  }
} catch (e) {
  console.log(`  ERROR: ${e.message.slice(0, 300)}`);
}

// Test 2: Image-to-image (like generate-floorplan clean step)
console.log("\n=== Test 2: image-to-image (floor plan redraw) ===");
try {
  // Use a small test image
  const testImageBase64 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasKoKQBeMQoLTzTr1QAAAABJRU5ErkJggg==",
    "base64"
  ).toString("base64");

  const res = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/png", data: testImageBase64 } },
        { text: "Redraw this as a clean architectural floor plan with thick black walls" },
      ],
    }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });
  const parts = res.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.inlineData) console.log(`  IMAGE OK: ${p.inlineData.mimeType}, ${Math.round(p.inlineData.data.length/1024)}KB base64`);
    if (p.text) console.log(`  TEXT: ${p.text.slice(0, 100)}`);
  }
} catch (e) {
  console.log(`  ERROR: ${e.message.slice(0, 300)}`);
}

console.log("\nDone!");
