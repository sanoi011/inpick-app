/**
 * Final validation: Test the cookie-based Naver Land API approach
 * that matches the updated naver-land-client.ts
 *
 * This script replicates the exact logic from the TypeScript module
 * to validate it works before integrating.
 */

const NAVER_LAND_API = 'https://new.land.naver.com/api';
const MAIN_PAGE_URL = 'https://new.land.naver.com/';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

let cachedCookies = null;

async function ensureCookies() {
  if (cachedCookies) return cachedCookies;

  console.log('  [cookie] Fetching main page for session cookies...');
  const res = await fetch(MAIN_PAGE_URL, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  const rawCookies = res.headers.getSetCookie?.() || [];
  cachedCookies = rawCookies.map(c => c.split(';')[0]).join('; ');
  await res.text(); // consume body

  const cookieNames = rawCookies.map(c => c.split('=')[0]);
  console.log(`  [cookie] Got cookies: ${cookieNames.join(', ')}`);
  return cachedCookies;
}

async function naverFetch(url) {
  const cookie = await ensureCookies();
  return fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'application/json',
      Referer: MAIN_PAGE_URL,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      Cookie: cookie,
    },
  });
}

async function main() {
  console.log('=== Final Validation: Naver Land API Cookie Session ===\n');

  // Test 1: Search complexes by region
  console.log('TEST 1: searchComplexByRegion (cortarNo=3020012000)');
  const res1 = await naverFetch(`${NAVER_LAND_API}/regions/complexes?cortarNo=3020012000&realEstateType=APT&order=`);
  console.log(`  Status: ${res1.status} ${res1.status === 200 ? 'OK' : 'FAIL'}`);
  if (res1.ok) {
    const data1 = await res1.json();
    const complexes = data1.complexList || [];
    console.log(`  Found ${complexes.length} complexes:`);
    for (const c of complexes.slice(0, 5)) {
      console.log(`    - ${c.complexName} (${c.complexNo}) ${c.totalHouseholdCount}세대, 준공: ${c.useApproveYmd || 'N/A'}`);
    }
    if (complexes.length > 5) console.log(`    ... and ${complexes.length - 5} more`);

    // Test 2: Get complex detail
    if (complexes.length > 0) {
      const firstComplex = complexes[0];
      console.log(`\nTEST 2: getComplexDetail (${firstComplex.complexName}, No: ${firstComplex.complexNo})`);

      await new Promise(r => setTimeout(r, 500));
      const res2 = await naverFetch(`${NAVER_LAND_API}/complexes/${firstComplex.complexNo}?sameAddressGroup=false`);
      console.log(`  Status: ${res2.status} ${res2.status === 200 ? 'OK' : 'FAIL'}`);
      if (res2.ok) {
        const data2 = await res2.json();
        const detail = data2.complexDetail;
        const pyeongs = data2.complexPyeongDetailList || [];
        console.log(`  Complex: ${detail?.complexName}`);
        console.log(`  Address: ${detail?.address}`);
        console.log(`  Dong count: ${detail?.totalDongCount}, Household: ${detail?.totalHouseholdCount}`);
        console.log(`  Pyeong types (${pyeongs.length}):`);
        for (const p of pyeongs) {
          console.log(`    - ${p.pyeongName}평 (전용 ${p.exclusiveArea}m², 공급 ${p.supplyArea}m²) ${p.roomCnt}방/${p.bathroomCnt}욕 ${p.householdCountByPyeong}세대`);
        }
      } else {
        const text2 = await res2.text();
        console.log(`  Error body: ${text2.slice(0, 200)}`);
      }
    }
  } else {
    const text1 = await res1.text();
    console.log(`  Error body: ${text1.slice(0, 200)}`);
  }

  // Test 3: Different region (Seoul Gangnam)
  console.log('\nTEST 3: searchComplexByRegion (cortarNo=1168010100, 서울 강남구 역삼동)');
  await new Promise(r => setTimeout(r, 500));
  const res3 = await naverFetch(`${NAVER_LAND_API}/regions/complexes?cortarNo=1168010100&realEstateType=APT&order=`);
  console.log(`  Status: ${res3.status} ${res3.status === 200 ? 'OK' : 'FAIL'}`);
  if (res3.ok) {
    const data3 = await res3.json();
    const complexes3 = data3.complexList || [];
    console.log(`  Found ${complexes3.length} complexes in Gangnam Yeoksam-dong`);
    for (const c of complexes3.slice(0, 3)) {
      console.log(`    - ${c.complexName} (${c.complexNo})`);
    }
  }

  // Test 4: Rapid sequential calls (reusing cached cookies)
  console.log('\nTEST 4: 5 rapid sequential calls (cached cookies)');
  const regions = ['3020012000', '1168010100', '1165010700', '4113510700', '2817710300'];
  const regionNames = ['대전 용산동', '강남 역삼동', '서초 반포동', '성남 분당', '부천 중동'];

  for (let i = 0; i < regions.length; i++) {
    const res = await naverFetch(`${NAVER_LAND_API}/regions/complexes?cortarNo=${regions[i]}&realEstateType=APT&order=`);
    const ok = res.status === 200;
    let count = 0;
    if (ok) {
      const data = await res.json();
      count = data.complexList?.length || 0;
    } else {
      await res.text();
    }
    console.log(`  [${ok ? 'OK' : 'FAIL'}] ${regionNames[i]} (${regions[i]}): HTTP ${res.status}, ${count} complexes`);
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
