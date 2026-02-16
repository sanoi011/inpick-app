/**
 * 전국 아파트 데이터 자동 수집 스크립트
 *
 * 네이버 부동산 지역 계층 API를 순회하여 전국 모든 읍면동의
 * 아파트 단지 정보를 naver-cache.json에 저장합니다.
 *
 * 사용법:
 *   node scripts/cache-naver-nationwide.mjs                    # 전국 전체
 *   node scripts/cache-naver-nationwide.mjs --sido 30          # 대전시만
 *   node scripts/cache-naver-nationwide.mjs --sigungu 30200    # 유성구만
 *   node scripts/cache-naver-nationwide.mjs --force            # 캐시 무시 재수집
 *   node scripts/cache-naver-nationwide.mjs --delay 2000       # 딜레이 조정(ms)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLI Arguments ───

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sido: null,      // 시도 필터 (예: "30")
    sigungu: null,   // 시군구 필터 (예: "30200")
    force: false,    // 캐시 무시 강제 재수집
    delay: 1500,     // 요청 간 딜레이 (ms)
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--sido":
        options.sido = args[++i];
        break;
      case "--sigungu":
        options.sigungu = args[++i];
        break;
      case "--force":
        options.force = true;
        break;
      case "--delay":
        options.delay = parseInt(args[++i]) || 1500;
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: node scripts/cache-naver-nationwide.mjs [options]

Options:
  --sido <code>      Filter by sido code (e.g., 30 for Daejeon)
  --sigungu <code>   Filter by sigungu code (e.g., 30200 for Yuseong-gu)
  --force            Re-fetch already cached regions
  --delay <ms>       Delay between requests (default: 1500)
  -h, --help         Show this help
`);
        process.exit(0);
    }
  }

  return options;
}

// ─── Constants ───

const NAVER_LAND_API = "https://new.land.naver.com/api";
const MAIN_PAGE_URL = "https://new.land.naver.com/";
const CACHE_FILE = path.resolve(__dirname, "../src/lib/data/naver-cache.json");

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

// ─── Helpers ───

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(base) {
  // base +/- 30% random jitter
  const jitter = base * 0.3;
  return base + (Math.random() * 2 - 1) * jitter;
}

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

// ─── Cookie Session ───

let _cookie = null;

async function getCookies() {
  console.log("[cookie] Fetching session cookies...");
  const res = await fetch(MAIN_PAGE_URL, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });

  let rawCookies = [];
  if (typeof res.headers.getSetCookie === "function") {
    rawCookies = res.headers.getSetCookie();
  } else {
    const setCookieHeader = res.headers.get("set-cookie") || "";
    if (setCookieHeader) {
      rawCookies = setCookieHeader.split(/,(?=\s*[A-Za-z_]+=)/);
    }
  }
  const cookieStr = rawCookies.map((c) => c.split(";")[0].trim()).join("; ");
  await res.text();

  if (!cookieStr) {
    throw new Error("Failed to obtain cookies");
  }

  console.log("[cookie] OK");
  _cookie = cookieStr;
  return cookieStr;
}

async function naverFetch(url, retries = 3) {
  if (!_cookie) await getCookies();

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json",
        Referer: MAIN_PAGE_URL,
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        Cookie: _cookie,
      },
    });

    if (res.status === 429) {
      const waitSec = attempt * 30;
      console.warn(`[429] Rate limited. Waiting ${waitSec}s... (attempt ${attempt}/${retries})`);
      // Refresh cookies on rate limit
      _cookie = null;
      await sleep(waitSec * 1000);
      await getCookies();
      continue;
    }

    if (!res.ok) {
      console.warn(`[fetch] HTTP ${res.status} for ${url}`);
      if (attempt < retries) {
        await sleep(5000);
        continue;
      }
      return null;
    }

    return res;
  }

  return null;
}

// ─── Region Hierarchy ───

async function getRegionList(cortarNo) {
  const url = `${NAVER_LAND_API}/regions/list?cortarNo=${cortarNo}`;
  const res = await naverFetch(url);
  if (!res) return [];

  const data = await res.json();
  const list = data?.regionList || [];

  return list.map((r) => ({
    cortarNo: String(r.cortarNo || ""),
    cortarName: String(r.cortarName || ""),
    cortarType: String(r.cortarType || ""),
  }));
}

// ─── Complex Fetcher ───

async function fetchComplexes(cortarNo) {
  const url = `${NAVER_LAND_API}/regions/complexes?cortarNo=${cortarNo}&realEstateType=APT&order=`;
  const res = await naverFetch(url);
  if (!res) return [];

  const data = await res.json();
  const rawComplexes = data?.complexList || [];

  return rawComplexes.map((c) => ({
    complexNo: String(c.complexNo || ""),
    complexName: String(c.complexName || ""),
    cortarNo: String(c.cortarNo || cortarNo),
    totalDongCount: Number(c.totalBuildingCount || c.totalDongCount || 0),
    totalHouseholdCount: Number(c.totalHouseholdCount || 0),
    approvalDate: String(c.useApproveYmd || ""),
    address: String(c.cortarAddress || c.address || ""),
    highFloor: c.highFloor ? Number(c.highFloor) : undefined,
    lowFloor: c.lowFloor ? Number(c.lowFloor) : undefined,
  }));
}

// ─── Cache I/O ───

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
      console.warn("[cache] Failed to parse existing cache, starting fresh");
    }
  }
  return {};
}

function saveCache(cache) {
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

// ─── Progress Tracker ───

class ProgressTracker {
  constructor() {
    this.startTime = Date.now();
    this.totalDongs = 0;
    this.processedDongs = 0;
    this.skippedDongs = 0;
    this.totalComplexes = 0;
    this.totalHouseholds = 0;
    this.errors = 0;
  }

  setTotal(total) {
    this.totalDongs = total;
  }

  addProcessed(complexCount, householdCount) {
    this.processedDongs++;
    this.totalComplexes += complexCount;
    this.totalHouseholds += householdCount;
  }

  addSkipped() {
    this.processedDongs++;
    this.skippedDongs++;
  }

  addError() {
    this.processedDongs++;
    this.errors++;
  }

  getProgress() {
    const elapsed = Date.now() - this.startTime;
    const done = this.processedDongs;
    const total = this.totalDongs;
    const pct = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";

    let eta = "calculating...";
    if (done > 0 && total > done) {
      const rate = elapsed / done;
      const remaining = (total - done) * rate;
      eta = formatTime(remaining);
    }

    return { done, total, pct, eta, elapsed: formatTime(elapsed) };
  }

  printProgress(currentRegion) {
    const { done, total, pct, eta, elapsed } = this.getProgress();
    const line = `[${pct}%] ${done}/${total} | ${currentRegion} | ${this.totalComplexes} complexes | ${this.totalHouseholds} households | ETA: ${eta} | Elapsed: ${elapsed}`;
    process.stdout.write(`\r${line}${"".padEnd(10)}`);
  }

  printSummary() {
    const elapsed = formatTime(Date.now() - this.startTime);
    console.log("\n\n=== Collection Summary ===");
    console.log(`  Regions processed:  ${this.processedDongs}`);
    console.log(`  Regions skipped:    ${this.skippedDongs} (already cached)`);
    console.log(`  Regions with error: ${this.errors}`);
    console.log(`  Total complexes:    ${this.totalComplexes}`);
    console.log(`  Total households:   ${this.totalHouseholds}`);
    console.log(`  Time elapsed:       ${elapsed}`);
    console.log("========================\n");
  }
}

// ─── Main Collection ───

async function collectAll(options) {
  console.log("\n=== Naver Land Nationwide Data Collection ===\n");
  console.log(`Cache file: ${CACHE_FILE}`);
  console.log(`Delay: ${options.delay}ms`);
  if (options.sido) console.log(`Sido filter: ${options.sido}`);
  if (options.sigungu) console.log(`Sigungu filter: ${options.sigungu}`);
  if (options.force) console.log("Force mode: ON (re-fetching cached regions)");
  console.log();

  // Step 1: Get cookies
  await getCookies();

  // Step 2: Load existing cache
  const cache = loadCache();
  const existingCount = Object.keys(cache).length;
  console.log(`[cache] Existing: ${existingCount} region(s)\n`);

  // Step 3: Get region hierarchy
  console.log("[hierarchy] Fetching sido list...");
  const sidos = await getRegionList("0000000000");
  console.log(`[hierarchy] Found ${sidos.length} sidos\n`);

  if (sidos.length === 0) {
    console.error("[hierarchy] Failed to get sido list. Check cookies/network.");
    process.exit(1);
  }

  // Step 4: Count total dongs for progress tracking
  const progress = new ProgressTracker();
  const dongList = []; // { cortarNo, cortarName, sidoName, sigunguName }

  console.log("[hierarchy] Building dong list...");
  for (const sido of sidos) {
    if (options.sido && !sido.cortarNo.startsWith(options.sido)) continue;

    const sigungus = await getRegionList(sido.cortarNo);
    await sleep(randomDelay(options.delay));

    for (const sigungu of sigungus) {
      if (options.sigungu && !sigungu.cortarNo.startsWith(options.sigungu)) continue;

      const dongs = await getRegionList(sigungu.cortarNo);
      await sleep(randomDelay(options.delay));

      for (const dong of dongs) {
        dongList.push({
          cortarNo: dong.cortarNo,
          cortarName: dong.cortarName,
          sidoName: sido.cortarName,
          sigunguName: sigungu.cortarName,
        });
      }

      console.log(`  ${sido.cortarName} > ${sigungu.cortarName}: ${dongs.length} dongs`);
    }
  }

  progress.setTotal(dongList.length);
  console.log(`\n[hierarchy] Total dongs to process: ${dongList.length}\n`);

  if (dongList.length === 0) {
    console.log("No regions to process. Check your filter options.");
    process.exit(0);
  }

  // Step 5: Collect apartment data for each dong
  let savedSigungu = "";

  for (const dong of dongList) {
    const regionLabel = `${dong.sidoName} ${dong.sigunguName} ${dong.cortarName}`;

    // Skip if already cached (unless --force)
    if (cache[dong.cortarNo] && !options.force) {
      progress.addSkipped();
      progress.printProgress(regionLabel + " (skip)");
      continue;
    }

    // Fetch complexes
    try {
      const complexes = await fetchComplexes(dong.cortarNo);
      const households = complexes.reduce((sum, c) => sum + c.totalHouseholdCount, 0);

      cache[dong.cortarNo] = {
        complexes,
        fetchedAt: new Date().toISOString(),
      };

      progress.addProcessed(complexes.length, households);
      progress.printProgress(regionLabel);
    } catch (err) {
      progress.addError();
      console.error(`\n[error] ${regionLabel}: ${err.message}`);
    }

    // Intermediate save per sigungu
    const currentSigungu = dong.cortarNo.substring(0, 5);
    if (currentSigungu !== savedSigungu) {
      if (savedSigungu) {
        saveCache(cache);
      }
      savedSigungu = currentSigungu;
    }

    await sleep(randomDelay(options.delay));
  }

  // Final save
  saveCache(cache);

  // Step 6: Summary
  progress.printSummary();

  const finalRegions = Object.keys(cache).length;
  let finalComplexes = 0;
  let finalHouseholds = 0;
  for (const region of Object.values(cache)) {
    const complexes = region.complexes || [];
    finalComplexes += complexes.length;
    finalHouseholds += complexes.reduce((sum, c) => sum + (c.totalHouseholdCount || 0), 0);
  }

  console.log("=== Cache Totals ===");
  console.log(`  Total regions in cache: ${finalRegions}`);
  console.log(`  Total complexes:        ${finalComplexes}`);
  console.log(`  Total households:       ${finalHouseholds}`);
  console.log("====================\n");
}

// ─── Entry Point ───

const options = parseArgs();

collectAll(options).catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
