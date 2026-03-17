/**
 * Test: Reverse pipeline - AI interior design images -> Architectural drawings
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, "..");
const API_KEY = "" + process.env.GOOGLE_GEMINI_API_KEY + "";
const MODEL = "gemini-3-pro-image-preview";
const GENERATE_IMAGE_URL = "https://inpick-app.vercel.app/api/project/generate-image";
const CLEAN_FLOORPLAN_URL = "https://pyhsjjtxcfmkcqmaxozd.supabase.co/storage/v1/object/public/uploads/floorplans/6165/3/clean.png";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function saveImage(filePath, buffer) {
  fs.writeFileSync(filePath, buffer);
  console.log("  [Saved] "+filePath+" ("+( buffer.length/1024).toFixed(1)+" KB)");
}

async function downloadImage(url, label) {
  console.log("\n[Download] "+label+":\n  "+url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed: "+res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("[Download] OK - "+(buf.length/1024).toFixed(1)+" KB");
  return buf;
}

async function generateDesignImage() {
  console.log("\n=== STEP 1: Generate Interior Design Image ===");
  const body = {
    prompt: "모던 미니멀 스타일 거실, 화이트 벽면에 원목 마루, L자형 소파, TV 콘솔",
    roomContext: "거실, 약 25m², 남향 대형 창문",
  };
  console.log("[API] POST "+GENERATE_IMAGE_URL);
  const t0 = Date.now();
  try {
    const res = await fetch(GENERATE_IMAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const elapsed = ((Date.now()-t0)/1000).toFixed(1);
    console.log("[API] Status: "+res.status+" ("+elapsed+"s)");
    if (!res.ok) { const e=await res.text(); console.log("[API] Error: "+e.substring(0,500)); throw new Error("API returned "+res.status); }
    const data = await res.json();
    if (data.imageUrl && data.imageUrl.startsWith("data:image/")) {
      const b64 = data.imageUrl.split(",")[1];
      const buf = Buffer.from(b64, "base64");
      saveImage(path.join(OUTPUT_DIR, "_design_living.png"), buf);
      return { buffer: buf, base64: b64, mimeType: "image/png" };
    }
    if (data.base64) {
      const buf = Buffer.from(data.base64, "base64");
      saveImage(path.join(OUTPUT_DIR, "_design_living.png"), buf);
      return { buffer: buf, base64: data.base64, mimeType: "image/png" };
    }
    if (data.imageUrl) {
      const r2 = await fetch(data.imageUrl);
      const buf = Buffer.from(await r2.arrayBuffer());
      saveImage(path.join(OUTPUT_DIR, "_design_living.png"), buf);
      return { buffer: buf, base64: buf.toString("base64"), mimeType: "image/png" };
    }
    console.log("[API] Keys: "+Object.keys(data).join(", "));
    throw new Error("No image in response");
  } catch (err) {
    console.log("[API] FAILED: "+err.message+" -> Falling back to Gemini...");
    return await generateDesignImageFallback();
  }
}

async function generateDesignImageFallback() {
  console.log("\n[Fallback] Generating via Gemini directly...");
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const t0 = Date.now();
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: "Generate a photorealistic interior design image: Modern minimalist style living room with white walls, natural oak hardwood flooring, L-shaped gray sofa, wall-mounted TV console, large south-facing window with natural light, warm and cozy atmosphere, architectural photography style." }] }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });
  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  console.log("[Fallback] Gemini responded in "+elapsed+"s");
  const parts = res.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      const buf = Buffer.from(part.inlineData.data, "base64");
      saveImage(path.join(OUTPUT_DIR, "_design_living.png"), buf);
      return { buffer: buf, base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
    }
    if (part.text) console.log("[Fallback] Text: "+part.text.substring(0,200));
  }
  throw new Error("Fallback failed - no image");
}

const TESTS = [
  {
    id: "A", name: "Test A: Design Image -> Floor Plan (평면도)",
    outputFile: "_render_to_floorplan.png",
    prompt: "Analyze this interior design photo and generate an architectural floor plan (평면도) of this room and the connected spaces visible or implied. Show: walls with proper thickness, door positions with swing arcs, window positions with double-line symbols, dimension lines in mm, furniture layout as outlines. Style: professional black and white CAD drawing.",
    useFloorPlan: false,
  },
  {
    id: "B", name: "Test B: Design Image -> Ceiling Plan (천정도)",
    outputFile: "_render_to_ceiling.png",
    prompt: "Analyze this interior design photo and generate a reflected ceiling plan (천정도) for this room. Show: ceiling boundary, recessed downlight positions (circles), indirect lighting cove areas, AC unit position, ceiling height annotation (CH: 2400mm), any bulkhead/soffit areas. Style: professional architectural drawing with dashed ceiling lines.",
    useFloorPlan: false,
  },
  {
    id: "C", name: "Test C: Design Image -> Elevation Drawing (입면전개도)",
    outputFile: "_render_to_elevation.png",
    prompt: "Analyze this interior design photo and generate interior elevation drawings (입면전개도) showing all visible walls unfolded. For each wall show: wall dimensions (width x 2400mm height), window/door positions with dimensions, furniture against the wall as outlines, electrical outlets (at 300mm), light switches (at 1200mm), material annotations. Style: professional architectural elevation drawing.",
    useFloorPlan: false,
  },
  {
    id: "D", name: "Test D: Design + Floor Plan -> Detailed Elevation (합성 입면전개도)",
    outputFile: "_combined_elevation.png",
    prompt: "I have two images: 1) A clean architectural floor plan of the apartment, 2) An AI-generated interior design photo of the living room. Based on BOTH images, generate detailed interior elevation drawings (입면전개도) for the living room showing all 4 walls (A-B-C-D). Match the wall dimensions from the floor plan and the design elements from the interior photo. Show: accurate wall dimensions from the floor plan, furniture/fixtures as shown in the design photo, material finishes, electrical outlets, switches. Style: professional architectural elevation drawing with dimension lines.",
    useFloorPlan: true,
  },
];

async function runTest(ai, test, designImage, floorPlanImage) {
  const outputPath = path.join(OUTPUT_DIR, test.outputFile);
  console.log("\n----------------------------------------------------------------------");
  console.log("  "+test.name);
  console.log("----------------------------------------------------------------------");
  const t0 = Date.now();
  let success=false, imageSize=0, textResponse="", errorMsg="";
  try {
    const parts = [];
    if (test.useFloorPlan && floorPlanImage) {
      parts.push({inlineData:{mimeType:"image/png",data:floorPlanImage.base64}});
      parts.push({inlineData:{mimeType:designImage.mimeType,data:designImage.base64}});
    } else {
      parts.push({inlineData:{mimeType:designImage.mimeType,data:designImage.base64}});
    }
    parts.push({ text: test.prompt });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE","TEXT"] },
    });
    if (response.candidates && response.candidates[0]) {
      const rp = response.candidates[0].content?.parts || [];
      for (const pt of rp) {
        if (pt.inlineData && pt.inlineData.data) {
          const ib = Buffer.from(pt.inlineData.data,"base64");
          saveImage(outputPath, ib);
          imageSize = ib.length; success = true;
        }
        if (pt.text) textResponse += pt.text;
      }
    }
    if (!success) { errorMsg="No image returned"; if(textResponse) errorMsg+=" - "+textResponse.substring(0,300); }
  } catch(err) { errorMsg=""+(err.message||err); }
  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  console.log("  [Result] "+(success?"SUCCESS":"FAIL"));
  if(imageSize) console.log("  [Size]   "+imageSize+" bytes ("+(imageSize/1024).toFixed(1)+" KB)");
  if(textResponse) console.log("  [Text]   "+textResponse.substring(0,400));
  if(errorMsg) console.log("  [Error]  "+errorMsg.substring(0,400));
  console.log("  [Time]   "+elapsed+"s");
  return {id:test.id,name:test.name,success,imageSize,textResponse:textResponse.substring(0,500),errorMsg,elapsed,outputFile:test.outputFile};
}

async function main() {
  console.log("======================================================================");
  console.log("  Render-to-Drawing: AI Interior Photo -> Architectural Drawings");
  console.log("  Model: "+MODEL);
  console.log("  Date: "+new Date().toISOString());
  console.log("======================================================================");

  const designImage = await generateDesignImage();

  let floorPlanImage = null;
  try {
    const fpBuf = await downloadImage(CLEAN_FLOORPLAN_URL, "Clean floor plan for Test D");
    saveImage(path.join(OUTPUT_DIR, "_clean_floorplan_ref.png"), fpBuf);
    floorPlanImage = { buffer: fpBuf, base64: fpBuf.toString("base64"), mimeType: "image/png" };
  } catch(err) {
    console.log("[Warning] Could not download floor plan: "+err.message);
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  console.log("\n[SDK] Initialized - model: "+MODEL);

  const results = [];
  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    if (test.useFloorPlan && !floorPlanImage) {
      console.log("\n  "+test.name+" [SKIPPED]");
      results.push({id:test.id,name:test.name,success:false,imageSize:0,textResponse:"",errorMsg:"Skipped",elapsed:"0",outputFile:test.outputFile});
      continue;
    }
    const result = await runTest(ai, test, designImage, floorPlanImage);
    results.push(result);
    if (i < TESTS.length - 1) {
      console.log("\n  Waiting 5 seconds...");
      await sleep(5000);
    }
  }

  console.log("\n======================================================================");
  console.log("  SUMMARY");
  console.log("======================================================================");
  console.log("  Model: "+MODEL+" | Total: "+results.length+" | Pass: "+results.filter(r=>r.success).length+" | Fail: "+results.filter(r=>!r.success).length);
  console.log("");
  for (const r of results) {
    const st=r.success?"PASS":"FAIL"; const sz=r.imageSize?(r.imageSize/1024).toFixed(1)+" KB":"-";
    console.log("  ["+st+"] "+r.name);
    console.log("    Output: "+r.outputFile+" | Size: "+sz+" | Time: "+r.elapsed+"s");
    if(r.textResponse) console.log("    Text: "+r.textResponse.substring(0,150));
    if(r.errorMsg) console.log("    Error: "+r.errorMsg.substring(0,250));
    console.log("");
  }
  const af=["_design_living.png","_clean_floorplan_ref.png",...results.filter(r=>r.success).map(r=>r.outputFile)];
  console.log("  Output files:");
  for(const f of af){const fp=path.join(OUTPUT_DIR,f);if(fs.existsSync(fp)){console.log("    "+f+" ("+(fs.statSync(fp).size/1024).toFixed(1)+" KB)");}}
  console.log("");
}

main().catch(err=>{console.error("\n[FATAL]",err);process.exit(1);});
