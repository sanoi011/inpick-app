/**
 * 네이버 부동산 API 연동 테스트 (쿠키 세션 방식)
 * 사용법: node scripts/test-naver-land.mjs [cortarNo] [buildingName]
 * 예시: node scripts/test-naver-land.mjs 3020012000 반석마을
 */

const cortarNo = process.argv[2] || "3020012000"; // 대전 유성구 지족동
const buildingName = process.argv[3] || "반석마을";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getCookies() {
  console.log("0. 세션 쿠키 획득...");
  const res = await fetch("https://new.land.naver.com/", {
    headers: { ...BROWSER_HEADERS, Accept: "text/html" },
    redirect: "follow",
  });
  const rawCookies = res.headers.getSetCookie?.() || [];
  const cookieStr = rawCookies.map(c => c.split(";")[0]).join("; ");
  await res.text();
  console.log(`   Cookies: ${cookieStr ? cookieStr.substring(0, 120) + "..." : "(없음)"}`);
  return cookieStr;
}

async function naverFetch(url, cookie) {
  return fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json",
      Referer: "https://new.land.naver.com/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      Cookie: cookie,
    },
  });
}

async function main() {
  console.log(`\n=== 네이버 부동산 API 테스트 (쿠키 세션) ===`);
  console.log(`cortarNo: ${cortarNo}, buildingName: ${buildingName}\n`);

  const cookie = await getCookies();
  if (!cookie) {
    console.log("   ✗ 쿠키 획득 실패");
    process.exit(1);
  }

  // Step 1: 지역 단지 목록
  console.log("\n1. 단지 목록 조회...");
  const listRes = await naverFetch(
    `https://new.land.naver.com/api/regions/complexes?cortarNo=${cortarNo}&realEstateType=APT&order=`,
    cookie
  );
  console.log(`   Status: ${listRes.status}`);

  if (listRes.status === 429) {
    console.log("   ✗ Rate limit! 쿠키가 동작하지 않음");
    process.exit(1);
  }
  if (!listRes.ok) {
    console.log(`   ✗ Error: ${listRes.statusText}`);
    process.exit(1);
  }

  const listData = await listRes.json();
  const complexes = listData?.complexList || [];
  console.log(`   ✓ ${complexes.length}개 단지 발견\n`);

  for (const c of complexes.slice(0, 10)) {
    console.log(`   - [${c.complexNo}] ${c.complexName} (${c.totalDongCount}동, ${c.totalHouseholdCount}세대)`);
  }
  if (complexes.length > 10) console.log(`   ... 외 ${complexes.length - 10}개`);

  // Step 2: 이름 매칭
  const name = buildingName.toLowerCase().replace(/\s/g, "");
  const matched = complexes.find(c => {
    const cName = c.complexName.toLowerCase().replace(/\s/g, "");
    return cName.includes(name) || name.includes(cName);
  });

  if (!matched) {
    console.log(`\n   ✗ "${buildingName}" 매칭 실패`);
    if (complexes.length > 0) {
      console.log(`   가능한 단지: ${complexes.map(c => c.complexName).join(", ")}`);
    }
    process.exit(0);
  }

  console.log(`\n2. 매칭 성공: ${matched.complexName} (complexNo: ${matched.complexNo})`);

  // Step 3: 상세 조회
  await sleep(1000);
  console.log("\n3. 단지 상세 조회...");
  const detailRes = await naverFetch(
    `https://new.land.naver.com/api/complexes/${matched.complexNo}?sameAddressGroup=false`,
    cookie
  );
  console.log(`   Status: ${detailRes.status}`);

  if (!detailRes.ok) {
    console.log(`   ✗ Error: ${detailRes.statusText}`);
    process.exit(1);
  }

  const detailData = await detailRes.json();
  const detail = detailData?.complexDetail;
  const pyeongList = detailData?.complexPyeongDetailList || [];

  if (detail) {
    console.log(`   ✓ ${detail.complexName}`);
    console.log(`     주소: ${detail.address}`);
    console.log(`     동 수: ${detail.totalDongCount}`);
    console.log(`     세대 수: ${detail.totalHouseholdCount}`);
    console.log(`     사용승인: ${detail.useApproveYmd}`);
  }

  console.log(`\n4. 평형 목록 (${pyeongList.length}개):`);
  for (const p of pyeongList) {
    console.log(`   - ${p.pyeongName}평 (전용 ${p.exclusiveArea}㎡ / 공급 ${p.supplyArea}㎡) | ${p.roomCnt}방 ${p.bathroomCnt}욕 | ${p.entranceTypeName || ""} | ${p.householdCountByPyeong}세대`);
  }

  // Step 4: Building API 시뮬레이션
  console.log("\n5. Building API 결과 미리보기:");
  const dongBase = (() => {
    const m = matched.complexName.match(/(\d+)\s*단지/);
    return m ? parseInt(m[1]) * 100 : 100;
  })();
  const dongCount = detail?.totalDongCount || 3;
  console.log(`   동 번호: ${dongBase + 1}동 ~ ${dongBase + dongCount}동`);
  console.log(`   평형 타입: ${pyeongList.map(p => `${p.pyeongName}평(${p.exclusiveArea}㎡)`).join(", ")}`);
  console.log(`   총 건물 수: ${dongCount} x ${pyeongList.length} x 6층 = ${dongCount * pyeongList.length * 6}개`);

  console.log("\n=== 테스트 완료 ===\n");
}

main().catch(e => console.error("Error:", e.message));
