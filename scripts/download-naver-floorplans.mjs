/**
 * 네이버 부동산 도면 이미지 다운로드 스크립트
 *
 * naver-cache.json에서 grandPlanUrl이 있는 모든 평형의 도면 이미지를 다운로드.
 * 저장 구조: public/floorplans/images/{complexNo}-{complexName}/{pyeongName}.png
 *
 * 실행: node scripts/download-naver-floorplans.mjs
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const CACHE_PATH = path.join(process.cwd(), "src/lib/data/naver-cache.json");
const OUTPUT_DIR = path.join(process.cwd(), "public/floorplans/images");

// 폴더명에 쓸 수 없는 문자 제거
function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim();
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 리다이렉트 처리
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on("finish", () => { fileStream.close(); resolve(true); });
      fileStream.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));

  // 다운로드 대상 수집
  const tasks = [];
  for (const [cortarNo, region] of Object.entries(cache)) {
    for (const c of region.complexes || []) {
      for (const p of c.pyeongList || []) {
        if (!p.grandPlanUrl) continue;
        const folderName = sanitize(`${c.complexNo}-${c.complexName}`);
        const fileName = sanitize(`${p.pyeongName}_${p.exclusiveArea}m2`);
        tasks.push({
          complexNo: c.complexNo,
          complexName: c.complexName,
          pyeongNo: p.pyeongNo,
          pyeongName: p.pyeongName,
          exclusiveArea: p.exclusiveArea,
          url: p.grandPlanUrl,
          folderName,
          fileName,
        });
      }
    }
  }

  console.log(`총 ${tasks.length}개 도면 이미지 다운로드 시작\n`);

  let success = 0, fail = 0, skip = 0;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const dir = path.join(OUTPUT_DIR, t.folderName);
    const ext = t.url.includes(".png") ? ".png" : ".jpg";
    const destPath = path.join(dir, `${t.fileName}${ext}`);

    // 이미 다운로드됨
    if (fs.existsSync(destPath)) {
      skip++;
      continue;
    }

    // 폴더 생성
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      await downloadFile(t.url, destPath);
      success++;
      if ((success + fail) % 50 === 0 || i === tasks.length - 1) {
        console.log(`[${i + 1}/${tasks.length}] 성공:${success} 실패:${fail} 건너뜀:${skip}`);
      }
    } catch (err) {
      fail++;
      console.error(`  FAIL: ${t.complexName} ${t.pyeongName} - ${err.message}`);
    }

    // Rate limiting: 100ms 간격
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n완료: 성공 ${success} / 실패 ${fail} / 건너뜀 ${skip} / 총 ${tasks.length}`);

  // 결과 매니페스트 저장
  const manifest = tasks.map((t) => {
    const ext = t.url.includes(".png") ? ".png" : ".jpg";
    return {
      complexNo: t.complexNo,
      complexName: t.complexName,
      pyeongNo: t.pyeongNo,
      pyeongName: t.pyeongName,
      exclusiveArea: t.exclusiveArea,
      imagePath: `/floorplans/images/${t.folderName}/${t.fileName}${ext}`,
    };
  });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`매니페스트 저장: ${path.join(OUTPUT_DIR, "manifest.json")}`);
}

main().catch(console.error);
