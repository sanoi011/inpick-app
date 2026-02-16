/**
 * 네이버 부동산 데이터 캐시 스크립트
 * Vercel 클라우드 IP에서 네이버 API가 차단되므로, 로컬에서 미리 데이터를 캐시
 *
 * 사용법: node scripts/cache-naver-data.mjs <cortarNo> [buildingName]
 * 예시:   node scripts/cache-naver-data.mjs 3020012000
 *         node scripts/cache-naver-data.mjs 3020012000 반석마을
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cortarNo = process.argv[2];
const buildingName = process.argv[3] || undefined;

if (!cortarNo) {
  console.error("Usage: node scripts/cache-naver-data.mjs <cortarNo> [buildingName]");
  console.error("Example: node scripts/cache-naver-data.mjs 3020012000");
  process.exit(1);
}

const NAVER_LAND_API = "https://new.land.naver.com/api";
const MAIN_PAGE_URL = "https://new.land.naver.com/";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

const CACHE_FILE = path.resolve(__dirname, "../src/lib/data/naver-cache.json");

// ─── Cookie Session ───

async function getCookies() {
  console.log("[cookie] Fetching session cookies from main page...");
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
  await res.text(); // consume body

  if (!cookieStr) {
    console.error("[cookie] Failed to obtain cookies");
    process.exit(1);
  }

  const cookieNames = rawCookies.map((c) => c.split("=")[0]);
  console.log(`[cookie] Got cookies: ${cookieNames.join(", ")}`);
  return cookieStr;
}

async function naverFetch(url, cookie) {
  return fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json",
      Referer: MAIN_PAGE_URL,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      Cookie: cookie,
    },
  });
}

// ─── Main ───

async function main() {
  console.log(`\n=== Naver Land Data Cache ===`);
  console.log(`cortarNo: ${cortarNo}`);
  if (buildingName) console.log(`buildingName: ${buildingName}`);
  console.log(`Cache file: ${CACHE_FILE}\n`);

  // Step 1: Get cookies
  const cookie = await getCookies();

  // Step 2: Fetch complex list for the region
  console.log(`\n[fetch] Fetching complex list for cortarNo=${cortarNo}...`);
  const listRes = await naverFetch(
    `${NAVER_LAND_API}/regions/complexes?cortarNo=${cortarNo}&realEstateType=APT&order=`,
    cookie
  );
  console.log(`[fetch] Status: ${listRes.status}`);

  if (listRes.status === 429) {
    console.error("[fetch] Rate limited (429). Cookie may not be working.");
    process.exit(1);
  }
  if (!listRes.ok) {
    console.error(`[fetch] Error: ${listRes.status} ${listRes.statusText}`);
    process.exit(1);
  }

  const listData = await listRes.json();
  const rawComplexes = listData?.complexList || [];
  console.log(`[fetch] Found ${rawComplexes.length} complexes`);

  if (rawComplexes.length === 0) {
    console.log("[fetch] No complexes found for this region. Nothing to cache.");
    process.exit(0);
  }

  // Step 3: Map raw API fields to NaverComplex format
  const complexes = rawComplexes.map((c) => ({
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

  // Print summary
  console.log("\n[complexes]");
  for (const c of complexes) {
    console.log(
      `  - [${c.complexNo}] ${c.complexName} (${c.totalDongCount}dong, ${c.totalHouseholdCount}households, approval: ${c.approvalDate || "N/A"})`
    );
  }

  // Step 4: Load existing cache (merge)
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const existing = fs.readFileSync(CACHE_FILE, "utf-8");
      cache = JSON.parse(existing);
      console.log(`\n[cache] Loaded existing cache with ${Object.keys(cache).length} region(s)`);
    } catch (err) {
      console.warn(`[cache] Failed to parse existing cache, starting fresh: ${err.message}`);
      cache = {};
    }
  }

  // Step 5: Merge data
  cache[cortarNo] = {
    complexes,
    fetchedAt: new Date().toISOString(),
  };

  // Step 6: Ensure directory exists and write cache
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  console.log(`\n[cache] Saved to ${CACHE_FILE}`);
  console.log(`[cache] Region ${cortarNo}: ${complexes.length} complexes cached`);
  console.log(`[cache] Total regions in cache: ${Object.keys(cache).length}`);

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
