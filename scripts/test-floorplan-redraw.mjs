import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const client = new GoogleGenAI({ apiKey: "" + process.env.GOOGLE_GEMINI_API_KEY + "" });

const imgPath = "drawings/_arch/59.png";
if (!fs.existsSync(imgPath)) {
  console.log("No test image at", imgPath);
  process.exit(0);
}

const imgBuf = fs.readFileSync(imgPath);
const base64 = imgBuf.toString("base64");
console.log("Image size:", Math.round(imgBuf.length / 1024), "KB");
console.log("Testing gemini-2.5-flash-image for floor plan redraw...");

const start = Date.now();
try {
  const res = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/png", data: base64 } },
        { text: "Redraw this apartment floor plan cleanly. Remove all text, watermarks, furniture, and appliances. Keep only walls, doors, and windows. Use thick black lines for walls." },
      ],
    }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  const elapsed = Date.now() - start;
  const parts = res.candidates?.[0]?.content?.parts || [];
  let hasImage = false;
  for (const p of parts) {
    if (p.inlineData) {
      hasImage = true;
      console.log(`IMAGE OK: ${p.inlineData.mimeType}, ${Math.round(p.inlineData.data.length / 1024)}KB base64`);
      // Save to file for inspection
      fs.writeFileSync("_test_redraw.png", Buffer.from(p.inlineData.data, "base64"));
      console.log("Saved to _test_redraw.png");
    }
    if (p.text) console.log(`TEXT: ${p.text.slice(0, 200)}`);
  }
  if (!hasImage) console.log("NO IMAGE returned");
  console.log(`Time: ${elapsed}ms`);
} catch (e) {
  console.log(`ERROR: ${e.message.slice(0, 400)}`);
}
