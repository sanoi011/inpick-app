import { NextRequest, NextResponse } from "next/server";

const JUSO_API_URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword");

  if (!keyword || keyword.trim().length < 2) {
    return NextResponse.json({ results: [], totalCount: 0 });
  }

  const confmKey = process.env.JUSO_API_KEY;
  if (!confmKey) {
    return NextResponse.json(
      { error: "주소 검색 서비스가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  try {
    const params = new URLSearchParams({
      confmKey,
      keyword: keyword.trim(),
      resultType: "json",
      currentPage: request.nextUrl.searchParams.get("page") || "1",
      countPerPage: "10",
    });

    const res = await fetch(`${JUSO_API_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`JUSO API responded with ${res.status}`);
    }

    const data = await res.json();
    const common = data?.results?.common;
    const jusoList = data?.results?.juso || [];

    if (common?.errorCode !== "0") {
      return NextResponse.json(
        { error: common?.errorMessage || "주소 검색 오류" },
        { status: 400 }
      );
    }

    const results = jusoList.map((j: Record<string, string>) => ({
      roadAddress: j.roadAddr,
      jibunAddress: j.jibunAddr,
      zipCode: j.zipNo,
      buildingName: j.bdNm || undefined,
      sigunguCode: j.sggCd || "",
      bcode: j.admCd || "",
      bdMgtSn: j.bdMgtSn || undefined,
      // 하위 호환
      bdKdcd: j.bdKdcd,
      siNm: j.siNm,
      sggNm: j.sggNm,
      emdNm: j.emdNm,
    }));

    return NextResponse.json({
      results,
      totalCount: parseInt(common?.totalCount || "0", 10),
    });
  } catch (err) {
    console.error("Address search error:", err);
    return NextResponse.json(
      { error: "주소 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
