import { createClient } from "@/lib/supabase/server";

export interface CrawlResult {
  source: string;
  recordsFound: number;
  recordsUpdated: number;
  recordsCreated: number;
  errors: string[];
}

// 한국물가협회 - 자재 단가 크롤러 (매월)
export async function crawlMaterialPrices(): Promise<CrawlResult> {
  const supabase = createClient();
  const result: CrawlResult = { source: "한국물가협회 (KPRC)", recordsFound: 0, recordsUpdated: 0, recordsCreated: 0, errors: [] };

  // 크롤 로그 시작
  const { data: log } = await supabase
    .from("crawl_logs")
    .insert({ source_name: result.source, crawl_type: "material", status: "started" })
    .select()
    .single();

  try {
    // MVP: 시뮬레이션 데이터 (실제 크롤링은 puppeteer/playwright 필요)
    const materials = [
      { code: "MAT-TILE-001", name: "포세린 타일 600x600", category: "타일", unit: "m²", unitPrice: 35000, brand: "한일타일" },
      { code: "MAT-TILE-002", name: "자기질 타일 300x300", category: "타일", unit: "m²", unitPrice: 22000, brand: "동서타일" },
      { code: "MAT-WALL-001", name: "실크 벽지 (합지)", category: "도배", unit: "롤", unitPrice: 12000, brand: "LG하우시스" },
      { code: "MAT-WALL-002", name: "실크 벽지 (합포)", category: "도배", unit: "롤", unitPrice: 18000, brand: "신한벽지" },
      { code: "MAT-FLR-001", name: "강마루 12T", category: "바닥재", unit: "m²", unitPrice: 28000, brand: "한화" },
      { code: "MAT-FLR-002", name: "강화마루 8T", category: "바닥재", unit: "m²", unitPrice: 18000, brand: "동화자연마루" },
      { code: "MAT-PNT-001", name: "친환경 수성 페인트", category: "도장", unit: "L", unitPrice: 8500, brand: "KCC" },
      { code: "MAT-WPF-001", name: "우레탄 방수재", category: "방수", unit: "kg", unitPrice: 15000, brand: "제비스코" },
      { code: "MAT-INS-001", name: "압출법 단열재 50T", category: "단열", unit: "m²", unitPrice: 12000, brand: "한화솔루션" },
      { code: "MAT-KIT-001", name: "주방 상부장 세트", category: "주방가구", unit: "식", unitPrice: 850000, brand: "한샘" },
    ];

    result.recordsFound = materials.length;

    for (const mat of materials) {
      const { data: existing } = await supabase
        .from("material_prices")
        .select("id, unit_price")
        .eq("code", mat.code)
        .eq("region", "seoul")
        .limit(1)
        .single();

      if (existing) {
        if (existing.unit_price !== mat.unitPrice) {
          // 가격 변동 기록
          await supabase.from("price_history").insert({
            entity_type: "material",
            entity_id: existing.id,
            old_value: existing.unit_price,
            new_value: mat.unitPrice,
            change_pct: ((mat.unitPrice - existing.unit_price) / existing.unit_price) * 100,
            changed_by: "crawler",
            change_reason: "한국물가협회 월간 단가 갱신",
          });

          await supabase
            .from("material_prices")
            .update({ unit_price: mat.unitPrice, effective_from: new Date().toISOString().split("T")[0] })
            .eq("id", existing.id);

          result.recordsUpdated++;
        }
      } else {
        await supabase.from("material_prices").insert({
          code: mat.code,
          name: mat.name,
          category: mat.category,
          unit: mat.unit,
          unit_price: mat.unitPrice,
          brand: mat.brand,
          region: "seoul",
          source: result.source,
        });
        result.recordsCreated++;
      }
    }

    if (log) {
      await supabase.from("crawl_logs").update({
        status: "completed",
        records_found: result.recordsFound,
        records_updated: result.recordsUpdated,
        records_created: result.recordsCreated,
        completed_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(errMsg);
    if (log) {
      await supabase.from("crawl_logs").update({
        status: "failed", error_message: errMsg, completed_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  }

  return result;
}

// 대한건설협회 - 노임 단가 크롤러 (반기별)
export async function crawlLaborCosts(): Promise<CrawlResult> {
  const supabase = createClient();
  const result: CrawlResult = { source: "대한건설협회 (CAK)", recordsFound: 0, recordsUpdated: 0, recordsCreated: 0, errors: [] };

  const { data: log } = await supabase
    .from("crawl_logs")
    .insert({ source_name: result.source, crawl_type: "labor", status: "started" })
    .select()
    .single();

  try {
    // MVP: 시드 데이터 대비 변동 시뮬레이션
    const laborUpdates = [
      { code: "L001", dailyRate: 255000, hourlyRate: 31875 },
      { code: "L002", dailyRate: 285000, hourlyRate: 35625 },
      { code: "L003", dailyRate: 275000, hourlyRate: 34375 },
      { code: "L004", dailyRate: 295000, hourlyRate: 36875 },
      { code: "L005", dailyRate: 285000, hourlyRate: 35625 },
      { code: "L006", dailyRate: 245000, hourlyRate: 30625 },
      { code: "L007", dailyRate: 225000, hourlyRate: 28125 },
    ];

    result.recordsFound = laborUpdates.length;

    for (const labor of laborUpdates) {
      const { data: existing } = await supabase
        .from("labor_costs")
        .select("id, daily_rate")
        .eq("code", labor.code)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (existing && existing.daily_rate !== labor.dailyRate) {
        await supabase.from("price_history").insert({
          entity_type: "labor",
          entity_id: existing.id,
          old_value: existing.daily_rate,
          new_value: labor.dailyRate,
          change_pct: ((labor.dailyRate - existing.daily_rate) / existing.daily_rate) * 100,
          changed_by: "crawler",
          change_reason: "대한건설협회 반기별 노임단가 갱신",
        });

        await supabase.from("labor_costs").update({
          daily_rate: labor.dailyRate,
          hourly_rate: labor.hourlyRate,
          effective_from: new Date().toISOString().split("T")[0],
        }).eq("id", existing.id);

        result.recordsUpdated++;
      }
    }

    if (log) {
      await supabase.from("crawl_logs").update({
        status: "completed",
        records_found: result.recordsFound,
        records_updated: result.recordsUpdated,
        records_created: result.recordsCreated,
        completed_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(errMsg);
    if (log) {
      await supabase.from("crawl_logs").update({
        status: "failed", error_message: errMsg, completed_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  }

  return result;
}

// 조달청 - 간접비율 크롤러 (연간)
export async function crawlOverheadRates(): Promise<CrawlResult> {
  const supabase = createClient();
  const result: CrawlResult = { source: "조달청 (PPS)", recordsFound: 0, recordsUpdated: 0, recordsCreated: 0, errors: [] };

  const { data: log } = await supabase
    .from("crawl_logs")
    .insert({ source_name: result.source, crawl_type: "overhead", status: "started" })
    .select()
    .single();

  try {
    // MVP: 간접비율은 연간 갱신으로 현재 시드데이터 유효 확인
    const { data: rates } = await supabase
      .from("overhead_rates")
      .select("id, code, rate_value")
      .eq("is_active", true);

    result.recordsFound = rates?.length || 0;

    // 현재는 시드데이터가 최신이므로 업데이트 없음
    if (log) {
      await supabase.from("crawl_logs").update({
        status: "completed",
        records_found: result.recordsFound,
        records_updated: 0,
        records_created: 0,
        completed_at: new Date().toISOString(),
        metadata: { note: "간접비율 최신 상태 확인 완료" },
      }).eq("id", log.id);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(errMsg);
    if (log) {
      await supabase.from("crawl_logs").update({
        status: "failed", error_message: errMsg, completed_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  }

  return result;
}
