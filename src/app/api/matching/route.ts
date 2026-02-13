import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MatchingCriteria {
  tradeCode: string;
  region?: string;
  budgetMax?: number;
  startDate?: string;
  weights?: {
    distance: number;
    rating: number;
    price: number;
    schedule: number;
    experience: number;
    reliability: number;
  };
}

const DEFAULT_WEIGHTS = {
  distance: 0.15,
  rating: 0.25,
  price: 0.20,
  schedule: 0.15,
  experience: 0.15,
  reliability: 0.10,
};

// POST: 전문업체 매칭
export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body: MatchingCriteria & { estimateId?: string } = await request.json();
    const { tradeCode, region = "seoul", budgetMax, startDate, weights = DEFAULT_WEIGHTS, estimateId } = body;

    if (!tradeCode) {
      return NextResponse.json({ error: "공종 코드가 필요합니다." }, { status: 400 });
    }

    const startTime = Date.now();

    // 1. 해당 공종의 활성 업체 조회
    const { data: trades } = await supabase
      .from("contractor_trades")
      .select("contractor_id, experience_years, is_primary")
      .eq("trade_code", tradeCode);

    if (!trades || trades.length === 0) {
      return NextResponse.json({ matches: [], totalMatched: 0, message: "해당 공종의 등록 업체가 없습니다." });
    }

    const contractorIds = trades.map((t) => t.contractor_id);
    const tradeMap = new Map(trades.map((t) => [t.contractor_id, t]));

    // 2. 업체 상세 정보 조회
    const { data: contractors } = await supabase
      .from("specialty_contractors")
      .select("*")
      .in("id", contractorIds)
      .eq("is_active", true)
      .eq("region", region);

    if (!contractors || contractors.length === 0) {
      return NextResponse.json({ matches: [], totalMatched: 0, message: "해당 지역에 등록된 업체가 없습니다." });
    }

    // 3. 일정 가용성 + 활성 프로젝트 수 확인
    const cIds = contractors.map((c) => c.id);
    let scheduleMap = new Map<string, boolean>();
    if (startDate) {
      const { data: schedules } = await supabase
        .from("contractor_schedules")
        .select("contractor_id, status")
        .in("contractor_id", cIds)
        .eq("date", startDate);

      scheduleMap = new Map(
        contractors.map((c) => {
          const sched = schedules?.find((s) => s.contractor_id === c.id);
          return [c.id, !sched || sched.status === "available"];
        })
      );
    }

    // 활성 프로젝트 수 (적을수록 가용성 높음)
    const { data: activeProjects } = await supabase
      .from("contractor_projects")
      .select("contractor_id")
      .in("contractor_id", cIds)
      .in("status", ["preparing", "in_progress"]);

    const activeCountMap = new Map<string, number>();
    for (const p of activeProjects || []) {
      activeCountMap.set(p.contractor_id, (activeCountMap.get(p.contractor_id) || 0) + 1);
    }

    // 입찰 가격 데이터 (같은 공종의 평균 입찰가 대비 경쟁력)
    const { data: bidData } = await supabase
      .from("bids")
      .select("contractor_id, amount")
      .in("contractor_id", cIds)
      .gt("amount", 0);

    const bidAmountMap = new Map<string, number[]>();
    const allBidAmounts: number[] = [];
    for (const b of bidData || []) {
      const amounts = bidAmountMap.get(b.contractor_id) || [];
      amounts.push(b.amount);
      bidAmountMap.set(b.contractor_id, amounts);
      allBidAmounts.push(b.amount);
    }
    const avgBidAmount = allBidAmounts.length > 0
      ? allBidAmounts.reduce((s, a) => s + a, 0) / allBidAmounts.length
      : 0;

    // 4. 6가지 요소 기반 점수 계산
    const maxRating = 5;
    const maxExperience = 20;

    const scored = contractors.map((contractor) => {
      const trade = tradeMap.get(contractor.id);

      // 거리 점수: 같은 지역 100, 인접 지역 70, 기타 30
      const ADJACENT_REGIONS: Record<string, string[]> = {
        seoul: ["gyeonggi", "incheon"],
        gyeonggi: ["seoul", "incheon", "gangwon", "chungnam", "chungbuk"],
        incheon: ["seoul", "gyeonggi"],
        busan: ["gyeongnam", "ulsan"],
        daegu: ["gyeongbuk", "gyeongnam"],
        daejeon: ["chungnam", "chungbuk", "sejong"],
        gwangju: ["jeonnam", "jeonbuk"],
        ulsan: ["busan", "gyeongnam", "gyeongbuk"],
        sejong: ["daejeon", "chungnam", "chungbuk"],
      };
      let distanceScore: number;
      if (contractor.region === region) {
        distanceScore = 1.0;
      } else if (ADJACENT_REGIONS[region]?.includes(contractor.region)) {
        distanceScore = 0.7;
      } else {
        distanceScore = 0.3;
      }

      // 평점 점수
      const ratingScore = (contractor.rating || 0) / maxRating;

      // 가격 점수: 평균 입찰가 대비 경쟁력 (낮을수록 높은 점수)
      const myBids = bidAmountMap.get(contractor.id) || [];
      let priceScore: number;
      if (myBids.length > 0 && avgBidAmount > 0) {
        const myAvg = myBids.reduce((s, a) => s + a, 0) / myBids.length;
        const ratio = myAvg / avgBidAmount;
        priceScore = Math.max(0, Math.min(1, 1.5 - ratio)); // 평균보다 저렴하면 높은 점수
      } else {
        priceScore = contractor.is_verified ? 0.7 : 0.5; // 데이터 없으면 인증 여부로 폴백
      }

      // 일정 점수: 스케줄 가용성 + 활성 프로젝트 수 기반
      const isAvailable = scheduleMap.get(contractor.id) ?? true;
      const activeCount = activeCountMap.get(contractor.id) || 0;
      const availabilityPenalty = Math.min(activeCount * 0.15, 0.6); // 프로젝트당 15% 감점, 최대 60%
      const scheduleScore = (isAvailable ? 1.0 : 0.2) - availabilityPenalty;

      // 경력 점수
      const years = trade?.experience_years || 0;
      const experienceScore = Math.min(years / maxExperience, 1.0);

      // 신뢰도 점수: 인증 + 리뷰 수 + 완료 프로젝트 수
      const reliabilityScore = Math.min(1.0,
        (contractor.is_verified ? 0.4 : 0) +
        Math.min((contractor.total_reviews || 0) / 50, 0.3) +
        Math.min((myBids.length) / 10, 0.3)
      );

      // 가중 합산
      const totalScore =
        distanceScore * weights.distance +
        ratingScore * weights.rating +
        Math.max(0, priceScore) * weights.price +
        Math.max(0, scheduleScore) * weights.schedule +
        experienceScore * weights.experience +
        reliabilityScore * weights.reliability;

      return {
        contractor: {
          id: contractor.id,
          companyName: contractor.company_name,
          contactName: contractor.contact_name,
          phone: contractor.phone,
          region: contractor.region,
          rating: contractor.rating,
          totalReviews: contractor.total_reviews,
          isVerified: contractor.is_verified,
        },
        scores: {
          distance: Math.round(distanceScore * 100),
          rating: Math.round(ratingScore * 100),
          price: Math.round(Math.max(0, priceScore) * 100),
          schedule: Math.round(Math.max(0, scheduleScore) * 100),
          experience: Math.round(experienceScore * 100),
          reliability: Math.round(reliabilityScore * 100),
          total: Math.round(totalScore * 100),
        },
        tradeInfo: {
          experienceYears: trade?.experience_years || 0,
          isPrimary: trade?.is_primary || false,
        },
        isAvailable: isAvailable,
      };
    });

    // 5. 점수 내림차순 정렬
    scored.sort((a, b) => b.scores.total - a.scores.total);

    const executionMs = Date.now() - startTime;

    // 6. 매칭 로그 저장
    await supabase.from("matching_logs").insert({
      estimate_id: estimateId || null,
      trade_code: tradeCode,
      criteria: { region, budgetMax, startDate, weights },
      results: scored.slice(0, 5).map((s) => ({ id: s.contractor.id, score: s.scores.total })),
      total_matched: scored.length,
      algorithm: "weighted_score_v1",
      execution_ms: executionMs,
    });

    return NextResponse.json({
      matches: scored,
      totalMatched: scored.length,
      executionMs,
    });
  } catch (err) {
    console.error("Matching API error:", err);
    return NextResponse.json({ error: "매칭 중 오류가 발생했습니다." }, { status: 500 });
  }
}
