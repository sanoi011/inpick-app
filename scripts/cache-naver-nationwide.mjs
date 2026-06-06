/**
 * 전국 부동산 데이터 자동 수집 스크립트
 *
 * 네이버 부동산 지역 계층 API를 순회하여 전국 모든 읍면동의
 * 아파트/빌라/오피스텔 단지 정보를 naver-cache.json에 저장합니다.
 *
 * --enrich 모드: 기존 캐시의 각 단지별 평형 상세(pyeong) 데이터 추가 수집
 *
 * 사용법:
 *   node scripts/cache-naver-nationwide.mjs                    # 전국 전체 (APT)
 *   node scripts/cache-naver-nationwide.mjs --sido 30          # 대전시만
 *   node scripts/cache-naver-nationwide.mjs --sigungu 30200    # 유성구만
 *   node scripts/cache-naver-nationwide.mjs --force            # 캐시 무시 재수집
 *   node scripts/cache-naver-nationwide.mjs --delay 2000       # 딜레이 조정(ms)
 *   node scripts/cache-naver-nationwide.mjs --enrich           # 평형 상세 수집
 *   node scripts/cache-naver-nationwide.mjs --enrich --sido 30 # 대전만 평형 수집
 *   node scripts/cache-naver-nationwide.mjs --type VL          # 빌라/연립만
 *   node scripts/cache-naver-nationwide.mjs --type OPST        # 오피스텔만
 *   node scripts/cache-naver-nationwide.mjs --type all         # APT+VL+OPST 전부
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
    enrich: false,   // 평형 상세 수집 모드
    types: ["APT"],  // 건물 유형 (APT, VL, OPST, ABYG, JGC)
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
      case "--enrich":
        options.enrich = true;
        break;
      case "--type": {
        const t = (args[++i] || "").toUpperCase();
        if (t === "ALL") {
          options.types = ["APT", "VL", "OPST"];
        } else if (["APT", "VL", "OPST", "ABYG", "JGC"].includes(t)) {
          options.types = [t];
        } else {
          console.error(`Unknown type: ${t}. Use APT, VL, OPST, or all`);
          process.exit(1);
        }
        break;
      }
      case "--help":
      case "-h":
        console.log(`
Usage: node scripts/cache-naver-nationwide.mjs [options]

Options:
  --sido <code>      Filter by sido code (e.g., 30 for Daejeon)
  --sigungu <code>   Filter by sigungu code (e.g., 30200 for Yuseong-gu)
  --force            Re-fetch already cached regions
  --delay <ms>       Delay between requests (default: 1500)
  --enrich           Fetch pyeong detail for each complex (adds to cache)
  --type <type>      Building type: APT (default), VL (villa), OPST (officetel), all
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

// ─── Building Type Mapping ───

const TYPE_MAP = {
  APT: { apiType: "APT", overviewType: "APARTMENT", label: "아파트" },
  VL: { apiType: "VL", overviewType: "VL", label: "빌라/연립" },
  OPST: { apiType: "OPST", overviewType: "OPST", label: "오피스텔" },
  ABYG: { apiType: "ABYG", overviewType: "ABYG", label: "아파트분양권" },
  JGC: { apiType: "JGC", overviewType: "JGC", label: "재건축" },
};

// ─── Complex Fetcher ───

async function fetchComplexes(cortarNo, realEstateType = "APT") {
  const url = `${NAVER_LAND_API}/regions/complexes?cortarNo=${cortarNo}&realEstateType=${realEstateType}&order=`;
  const res = await naverFetch(url);
  if (!res) return [];

  const data = await res.json();
  const rawComplexes = data?.complexList || [];

  return rawComplexes.map((c) => ({
    complexNo: String(c.complexNo || ""),
    complexName: String(c.complexName || ""),
    cortarNo: String(c.cortarNo || cortarNo),
    realEstateType,
    totalDongCount: Number(c.totalBuildingCount || c.totalDongCount || 0),
    totalHouseholdCount: Number(c.totalHouseholdCount || 0),
    approvalDate: String(c.useApproveYmd || ""),
    address: String(c.cortarAddress || c.address || ""),
    highFloor: c.highFloor ? Number(c.highFloor) : undefined,
    lowFloor: c.lowFloor ? Number(c.lowFloor) : undefined,
  }));
}

/**
 * 단지 overview 조회 (평형 + 동 + 도면 URL)
 * /api/complexes/overview/{complexNo}?type=APARTMENT|VL|OPST
 */
async function fetchComplexOverview(complexNo, overviewType = "APARTMENT") {
  const url = `${NAVER_LAND_API}/complexes/overview/${complexNo}?type=${overviewType}`;
  const res = await naverFetch(url);
  if (!res) return null;

  const data = await res.json();
  if (!data || !data.complexName) return null;

  const pyeongs = (data.pyeongs || []).map((p) => ({
    pyeongNo: Number(p.pyeongNo || 0),
    pyeongName: String(p.pyeongName || ""),
    exclusiveArea: parseFloat(p.exclusiveArea) || 0,
    supplyArea: parseFloat(p.supplyArea) || p.supplyAreaDouble || 0,
    grandPlanUrl: p.grandPlanUrl ? `https://landthumb-phinf.pstatic.net${p.grandPlanUrl}` : undefined,
  }));

  const dongs = (data.dongs || []).map((d) => ({
    dongNo: String(d.dongNo || ""),
    dongName: String(d.bildName || ""),
  }));

  return { pyeongs, dongs };
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

  // Step 5: Collect data for each dong (all requested types)
  const typeLabels = options.types.map((t) => TYPE_MAP[t]?.label || t).join("+");
  console.log(`[types] Collecting: ${typeLabels} (${options.types.join(",")})\n`);

  let savedSigungu = "";

  for (const dong of dongList) {
    const regionLabel = `${dong.sidoName} ${dong.sigunguName} ${dong.cortarName}`;

    // For APT type, skip if already cached (unless --force)
    // For non-APT types, always check for new data to merge
    const hasNonApt = options.types.some((t) => t !== "APT");
    if (cache[dong.cortarNo] && !options.force && !hasNonApt) {
      progress.addSkipped();
      progress.printProgress(regionLabel + " (skip)");
      continue;
    }

    // Fetch complexes for all requested types
    try {
      let allComplexes = cache[dong.cortarNo]?.complexes || [];
      const existingNos = new Set(allComplexes.map((c) => c.complexNo));

      for (const type of options.types) {
        // Skip APT if already cached and not force
        if (type === "APT" && cache[dong.cortarNo] && !options.force) continue;

        const complexes = await fetchComplexes(dong.cortarNo, type);
        // Merge: add only new complexes (by complexNo)
        for (const c of complexes) {
          if (!existingNos.has(c.complexNo)) {
            allComplexes.push(c);
            existingNos.add(c.complexNo);
          }
        }

        if (options.types.length > 1) await sleep(randomDelay(options.delay * 0.5));
      }

      const households = allComplexes.reduce((sum, c) => sum + c.totalHouseholdCount, 0);

      cache[dong.cortarNo] = {
        complexes: allComplexes,
        fetchedAt: new Date().toISOString(),
      };

      progress.addProcessed(allComplexes.length, households);
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

// ─── Enrich Mode: Fetch pyeong detail per complex ───

async function enrichAll(options) {
  console.log("\n=== Naver Land Pyeong Detail Enrichment ===\n");
  console.log(`Cache file: ${CACHE_FILE}`);
  console.log(`Delay: ${options.delay}ms`);
  if (options.sido) console.log(`Sido filter: ${options.sido}`);
  if (options.sigungu) console.log(`Sigungu filter: ${options.sigungu}`);
  if (options.force) console.log("Force mode: ON (re-fetching enriched complexes)");
  console.log();

  await getCookies();

  const cache = loadCache();

  // Build list of complexes to enrich
  const complexList = []; // { cortarNo, complexNo, complexName, realEstateType }
  for (const [cortarNo, region] of Object.entries(cache)) {
    if (options.sido && !cortarNo.startsWith(options.sido)) continue;
    if (options.sigungu && !cortarNo.startsWith(options.sigungu)) continue;

    for (const c of (region.complexes || [])) {
      // Skip if already enriched (has pyeongList AND dongList)
      if (c.pyeongList && c.pyeongList.length > 0 && c.dongList && c.dongList.length > 0 && !options.force) continue;
      complexList.push({
        cortarNo,
        complexNo: c.complexNo,
        complexName: c.complexName,
        realEstateType: c.realEstateType || "APT",
      });
    }
  }

  console.log(`[enrich] Total complexes to enrich: ${complexList.length}\n`);

  if (complexList.length === 0) {
    console.log("No complexes need enrichment. Use --force to re-fetch.");
    process.exit(0);
  }

  const startTime = Date.now();
  let enriched = 0;
  let failed = 0;
  let savedSigungu = "";

  for (let i = 0; i < complexList.length; i++) {
    const { cortarNo, complexNo, complexName, realEstateType } = complexList[i];
    const pct = ((i + 1) / complexList.length * 100).toFixed(1);
    const elapsed = formatTime(Date.now() - startTime);
    const rate = (Date.now() - startTime) / (i + 1);
    const eta = formatTime((complexList.length - i - 1) * rate);

    // Determine overview API type based on realEstateType
    const overviewType = TYPE_MAP[realEstateType]?.overviewType || "APARTMENT";

    try {
      const overview = await fetchComplexOverview(complexNo, overviewType);
      if (overview) {
        const region = cache[cortarNo];
        if (region) {
          const idx = region.complexes.findIndex((c) => c.complexNo === complexNo);
          if (idx >= 0) {
            if (overview.pyeongs.length > 0) {
              region.complexes[idx].pyeongList = overview.pyeongs;
            }
            if (overview.dongs.length > 0) {
              region.complexes[idx].dongList = overview.dongs;
            }
            enriched++;
          }
        }
      }
    } catch (err) {
      failed++;
    }

    process.stdout.write(`\r[${pct}%] ${i + 1}/${complexList.length} | ${complexName} | enriched: ${enriched} | failed: ${failed} | ETA: ${eta} | Elapsed: ${elapsed}${"".padEnd(10)}`);

    // Intermediate save per sigungu
    const currentSigungu = cortarNo.substring(0, 5);
    if (currentSigungu !== savedSigungu) {
      if (savedSigungu) saveCache(cache);
      savedSigungu = currentSigungu;
    }

    await sleep(randomDelay(options.delay));
  }

  // Final save
  saveCache(cache);

  const totalElapsed = formatTime(Date.now() - startTime);
  console.log("\n\n=== Enrichment Summary ===");
  console.log(`  Complexes processed: ${complexList.length}`);
  console.log(`  Successfully enriched: ${enriched}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Time elapsed: ${totalElapsed}`);
  console.log("========================\n");
}

// ─── Entry Point ───

const options = parseArgs();

if (options.enrich) {
  enrichAll(options).catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
} else {
  collectAll(options).catch((err) => {
    console.error("\nFatal error:", err.message);
    process.exit(1);
  });
}
