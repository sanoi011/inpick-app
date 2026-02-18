/**
 * E2E 세그멘테이션 마스크 테스트
 * 실제 Next.js API를 통해 도면 생성 → 마스크 적용 검증
 *
 * Usage: node scripts/test-e2e-mask.mjs
 *   (dev 서버가 localhost:3000에서 실행 중이어야 함)
 */
import fs from "fs";

const API_BASE = "http://localhost:3000";

// 테스트 대상: 샘물타운 105형 (84.94m²)
const TEST_PARAMS = {
  complexNo: "6165",
  pyeongNo: 3,
  grandPlanUrl:
    "https://landthumb-phinf.pstatic.net/20120319_112/hscp_img_1332148886509PqnKo_JPEG/GW70711_1332148885163.jpg",
  complexName: "샘물타운",
  pyeongName: "105",
  exclusiveArea: 84.94,
  isExpanded: true,
  force: true, // 캐시 무시하고 재생성
};

async function main() {
  console.log("=== E2E Segmentation Mask Test ===");
  console.log(`Target: ${TEST_PARAMS.complexName} ${TEST_PARAMS.pyeongName}평형 (${TEST_PARAMS.exclusiveArea}m²)`);
  console.log(`Grand Plan URL: ${TEST_PARAMS.grandPlanUrl.substring(0, 80)}...`);
  console.log("");

  // ── Step 1: POST 도면 생성 (SSE) ──
  console.log("[1/4] Calling generate-floorplan API (SSE)...");
  const startTime = Date.now();

  const res = await fetch(`${API_BASE}/api/project/generate-floorplan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(TEST_PARAMS),
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const err = await res.json();
      console.error("   FAIL:", err.error || JSON.stringify(err));
    } else {
      console.error("   FAIL: HTTP", res.status);
    }
    process.exit(1);
  }

  // Check if it's a cached JSON response
  const contentType = res.headers.get("content-type") || "";
  let result = null;

  if (contentType.includes("application/json")) {
    result = await res.json();
    if (result.cached) {
      console.log("   Cached response - skipping SSE");
    }
  } else {
    // Parse SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastProgress = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.event === "progress") {
            const msg = `   [${data.progress}%] ${data.message}`;
            if (msg !== lastProgress) {
              console.log(msg);
              lastProgress = msg;
            }
          } else if (data.event === "complete") {
            result = data;
            console.log(`   [100%] ${data.message}`);
          } else if (data.event === "error") {
            console.error("   ERROR:", data.message);
            process.exit(1);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   Total time: ${elapsed}s`);
  console.log("");

  if (!result) {
    console.error("   FAIL: No result from pipeline");
    process.exit(1);
  }

  // ── Step 2: 결과 검증 ──
  console.log("[2/4] Validating pipeline result...");
  console.log(`   finalUrl:      ${result.finalUrl ? "YES" : "NO"}`);
  console.log(`   finalMirrorUrl: ${result.finalMirrorUrl ? "YES" : "NO"}`);
  console.log(`   maskUrl:       ${result.maskUrl ? "YES" : "NO"}`);
  console.log(`   maskMirrorUrl: ${result.maskMirrorUrl ? "YES" : "NO"}`);
  console.log(`   roomColorMap:  ${result.roomColorMap ? `YES (${result.roomColorMap.rooms?.length} rooms)` : "NO"}`);

  if (!result.maskUrl) {
    console.error("\n   FAIL: No mask URL in result!");
    console.log("   (마스크 생성에 실패했을 수 있습니다)");
    process.exit(1);
  }

  if (!result.roomColorMap?.rooms?.length) {
    console.error("\n   FAIL: No roomColorMap in result!");
    process.exit(1);
  }

  console.log("\n   Room color map:");
  for (const room of result.roomColorMap.rooms) {
    console.log(`     ${room.color} → ${room.type} (${room.label})`);
  }
  console.log("");

  // ── Step 3: 마스크 이미지 다운로드 + 검증 ──
  console.log("[3/4] Downloading and validating mask image...");

  const maskRes = await fetch(result.maskUrl);
  if (!maskRes.ok) {
    console.error(`   FAIL: Mask download failed: HTTP ${maskRes.status}`);
    process.exit(1);
  }

  const maskBuffer = Buffer.from(await maskRes.arrayBuffer());
  const maskContentType = maskRes.headers.get("content-type") || "";
  console.log(`   Mask size: ${(maskBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`   Content-Type: ${maskContentType}`);

  // PNG 여부 확인 (89 50 4E 47 = PNG magic bytes)
  const isPng = maskBuffer[0] === 0x89 && maskBuffer[1] === 0x50 && maskBuffer[2] === 0x4E && maskBuffer[3] === 0x47;
  console.log(`   PNG format: ${isPng ? "YES" : "NO (expected PNG!)"}`);

  // sharp로 상세 분석
  try {
    const sharp = (await import("sharp")).default;

    const maskMeta = await sharp(maskBuffer).metadata();
    console.log(`   Mask dimensions: ${maskMeta.width}x${maskMeta.height}`);

    // Clean 이미지도 다운로드해서 크기 비교
    const cleanRes = await fetch(result.finalUrl);
    const cleanBuffer = Buffer.from(await cleanRes.arrayBuffer());
    const cleanMeta = await sharp(cleanBuffer).metadata();
    console.log(`   Clean dimensions: ${cleanMeta.width}x${cleanMeta.height}`);

    if (maskMeta.width === cleanMeta.width && maskMeta.height === cleanMeta.height) {
      console.log("   Dimensions match!");
    } else {
      console.log("   WARNING: Dimension mismatch (route.ts should have resized)");
    }

    // 픽셀 분석 (FloorPlanCanvas 알고리즘)
    const { data, info } = await sharp(maskBuffer).raw().toBuffer({ resolveWithObject: true });

    const expectedColors = {
      living:    { hex: "#FF0000", rgb: [255, 0, 0],     label: "거실" },
      bedroom1:  { hex: "#00FF00", rgb: [0, 255, 0],     label: "침실1" },
      bedroom2:  { hex: "#0000FF", rgb: [0, 0, 255],     label: "침실2" },
      bedroom3:  { hex: "#FFFF00", rgb: [255, 255, 0],   label: "침실3" },
      kitchen:   { hex: "#FF00FF", rgb: [255, 0, 255],   label: "주방" },
      bathroom1: { hex: "#00FFFF", rgb: [0, 255, 255],   label: "욕실1" },
      bathroom2: { hex: "#FF8000", rgb: [255, 128, 0],   label: "욕실2" },
      entrance:  { hex: "#8000FF", rgb: [128, 0, 255],   label: "현관" },
      balcony1:  { hex: "#00FF80", rgb: [0, 255, 128],   label: "발코니1" },
      balcony2:  { hex: "#FF0080", rgb: [255, 0, 128],   label: "발코니2" },
      utility:   { hex: "#80FF00", rgb: [128, 255, 0],   label: "다용도실" },
      dressroom: { hex: "#0080FF", rgb: [0, 128, 255],   label: "드레스룸" },
      hallway:   { hex: "#808080", rgb: [128, 128, 128], label: "복도" },
    };

    const colorTargets = Object.entries(expectedColors).map(([type, c]) => ({
      type, r: c.rgb[0], g: c.rgb[1], b: c.rgb[2],
    }));

    const roomPixelCounts = {};
    const pixels = info.width * info.height;
    let wallPx = 0, bgPx = 0, matchedPx = 0, unmatchedPx = 0;

    for (let i = 0; i < pixels; i++) {
      const pr = data[i * info.channels];
      const pg = data[i * info.channels + 1];
      const pb = data[i * info.channels + 2];

      if (pr < 20 && pg < 20 && pb < 20) { wallPx++; continue; }
      if (pr > 235 && pg > 235 && pb > 235) { bgPx++; continue; }

      let bestDist = Infinity, bestType = null;
      for (const c of colorTargets) {
        const d = (pr - c.r) ** 2 + (pg - c.g) ** 2 + (pb - c.b) ** 2;
        if (d < bestDist) { bestDist = d; bestType = c.type; }
      }
      if (bestType && bestDist < 7500) {
        roomPixelCounts[bestType] = (roomPixelCounts[bestType] || 0) + 1;
        matchedPx++;
      } else {
        unmatchedPx++;
      }
    }

    console.log("");
    console.log("   === Pixel Classification (FloorPlanCanvas algorithm) ===");
    console.log(`   Background (white): ${bgPx.toLocaleString()} px (${((bgPx / pixels) * 100).toFixed(1)}%)`);
    console.log(`   Walls (black):      ${wallPx.toLocaleString()} px (${((wallPx / pixels) * 100).toFixed(1)}%)`);
    console.log(`   Room matched:       ${matchedPx.toLocaleString()} px (${((matchedPx / pixels) * 100).toFixed(1)}%)`);
    console.log(`   Unmatched:          ${unmatchedPx.toLocaleString()} px (${((unmatchedPx / pixels) * 100).toFixed(1)}%)`);
    console.log("");

    const sortedRooms = Object.entries(roomPixelCounts).sort((a, b) => b[1] - a[1]);
    const detectedCount = sortedRooms.length;

    if (detectedCount > 0) {
      console.log(`   Detected ${detectedCount} rooms in mask:`);
      for (const [type, count] of sortedRooms) {
        const pct = ((count / pixels) * 100).toFixed(1);
        const label = expectedColors[type]?.label || type;
        console.log(`     OK ${expectedColors[type]?.hex} → ${pct}% (${count.toLocaleString()} px) — ${label}`);
      }
    } else {
      console.log("   WARNING: No rooms detected in mask!");
    }

    // 로컬에 저장
    const outPath = "test-results/e2e-mask";
    fs.mkdirSync(outPath, { recursive: true });
    fs.writeFileSync(`${outPath}/mask.png`, maskBuffer);
    fs.writeFileSync(`${outPath}/clean.png`, cleanBuffer);
    console.log(`\n   Saved to ${outPath}/`);

  } catch (e) {
    console.log("   (sharp not available for detailed analysis)");
    console.log("   Error:", e.message);
  }

  // ── Step 4: DB 확인 ──
  console.log("");
  console.log("[4/4] Verifying DB record...");

  const checkRes = await fetch(
    `${API_BASE}/api/project/generate-floorplan?complexNo=${TEST_PARAMS.complexNo}&pyeongNo=${TEST_PARAMS.pyeongNo}`
  );
  const checkData = await checkRes.json();

  console.log(`   DB cached: ${checkData.exists ? "YES" : "NO"}`);
  if (checkData.exists) {
    console.log(`   DB maskUrl: ${checkData.maskUrl ? "YES" : "NO"}`);
    console.log(`   DB roomColorMap: ${checkData.roomColorMap ? `YES (${checkData.roomColorMap.rooms?.length} rooms)` : "NO"}`);
  }

  // ── Summary ──
  console.log("");
  console.log("=== E2E Test Summary ===");
  console.log(`Pipeline: ${elapsed}s`);
  console.log(`Clean image: ${result.finalUrl ? "PASS" : "FAIL"}`);
  console.log(`Mirror image: ${result.finalMirrorUrl ? "PASS" : "FAIL"}`);
  console.log(`Mask image: ${result.maskUrl ? "PASS" : "FAIL"}`);
  console.log(`Mask mirror: ${result.maskMirrorUrl ? "PASS" : "FAIL"}`);
  console.log(`Room map: ${result.roomColorMap?.rooms?.length > 0 ? "PASS" : "FAIL"} (${result.roomColorMap?.rooms?.length || 0} rooms)`);
  console.log(`DB cache: ${checkData.exists ? "PASS" : "FAIL"}`);

  const allPass = result.finalUrl && result.maskUrl && result.roomColorMap?.rooms?.length > 0 && checkData.exists;
  console.log(`\nResult: ${allPass ? "ALL PASS" : "PARTIAL"}`);

  if (allPass) {
    console.log("\n마스크가 정상 생성되었습니다.");
    console.log("브라우저에서 확인:");
    console.log(`  1. http://localhost:3000/project/test-mask/design 에서 도면 생성`);
    console.log(`  2. 렌더링 탭으로 이동 → FloorPlanCanvas에서 자재 선택 시 색상 오버레이 확인`);
    console.log(`\n직접 확인:`);
    console.log(`  - Clean: ${result.finalUrl}`);
    console.log(`  - Mask:  ${result.maskUrl}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
