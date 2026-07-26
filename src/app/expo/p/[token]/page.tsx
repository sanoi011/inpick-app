import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPO_MONEY_SOURCE_LABELS,
  buildCatalogEstimate,
  buildConceptualRange,
  formatKrw,
  isExpoEstimateOverrides,
  type ExpoCatalogEstimate,
  type ExpoConceptualRange,
} from "@/lib/expo/estimate";
import { isExpoBoothScene, findCatalogItem } from "@/lib/expo/scene";
import { isExpoBrandKit } from "@/lib/expo/brand-import";
import {
  evaluateEventRules,
  hasEventRuleInput,
  hasEventRuleViolation,
  hasOfficialServicesInput,
  isExpoEventInfo,
  isExpoOfficialServices,
} from "@/lib/expo/event-rules";
import {
  EXPO_READINESS_STATE_LABELS,
  evaluateProposalReadiness,
  readinessPercent,
} from "@/lib/expo/readiness";
import type { ExpoConfirmedDimensions } from "@/lib/expo/footprint";
import { isExpoClientDecision } from "@/lib/expo/client-decision";
import ProposalDecisionForm from "@/components/expo/ProposalDecisionForm";

/**
 * 공개 읽기전용 제안 페이지 — 공유 토큰으로만 접근 (service role 조회).
 * 검토용 공유본: 가정/AI 컨셉/allowance 라벨을 절대 숨기지 않는다.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "INPICK EXPO 부스 제안 (검토용)",
  robots: { index: false, follow: false },
};

export default async function ExpoSharedProposalPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("expo_projects")
    .select(
      "title, area_input, area_unit, footprint, confirmed_dimensions, scene, concept_image_url, brand, event, official_services, estimate_overrides, quick_fields, client_decision, updated_at",
    )
    .eq("share_token", token)
    .maybeSingle();
  if (!project) notFound();

  const scene = isExpoBoothScene(project.scene) ? project.scene : null;
  const confirmed =
    (project.confirmed_dimensions as ExpoConfirmedDimensions | null) ?? null;
  const brand = isExpoBrandKit(project.brand) ? project.brand : null;
  const event = isExpoEventInfo(project.event) ? project.event : null;
  const officialServices = isExpoOfficialServices(project.official_services)
    ? project.official_services
    : null;
  const footprint = project.footprint as {
    canonicalAreaSqm?: number;
    selected?: { widthM?: number; depthM?: number; label?: string };
    wallHeightM?: number;
  } | null;

  let estimate: ExpoCatalogEstimate | null = null;
  let range: ExpoConceptualRange | null = null;
  try {
    if (confirmed)
      estimate = buildCatalogEstimate(scene, confirmed, {
        powerKw: event?.powerKw ?? null,
        overrides: isExpoEstimateOverrides(project.estimate_overrides)
          ? project.estimate_overrides
          : null,
      });
    else if (footprint?.canonicalAreaSqm)
      range = buildConceptualRange(footprint.canonicalAreaSqm);
  } catch {
    // 견적 계산 불가 시 금액 섹션 생략 (없는 값을 지어내지 않는다)
  }

  const eventItems = event
    ? evaluateEventRules(
        event,
        confirmed?.wallHeightM ?? footprint?.wallHeightM ?? null,
      )
    : [];
  const clientDecision = isExpoClientDecision(project.client_decision)
    ? project.client_decision
    : null;
  const readiness = evaluateProposalReadiness({
    hasFootprint: Boolean(footprint),
    dimensionsConfirmed: Boolean(confirmed),
    componentCount: scene?.components.length ?? 0,
    priceStage: estimate ? "catalog_estimate" : range ? "conceptual_range" : null,
    brandConfirmed: Boolean(brand),
    eventRules: {
      entered: event ? hasEventRuleInput(event) : false,
      violation: hasEventRuleViolation(eventItems),
    },
    clientDecision: clientDecision?.decision ?? null,
    officialServicesEntered: officialServices
      ? hasOfficialServicesInput(officialServices)
      : false,
  });

  const componentCounts = new Map<string, number>();
  for (const component of scene?.components ?? []) {
    componentCounts.set(
      component.catalogId,
      (componentCounts.get(component.catalogId) ?? 0) + 1,
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-bold tracking-[0.2em] text-blue-600">
          INPICK EXPO · 제안 공유본
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-black">
          {project.title}
        </h1>
        <p
          role="note"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800"
        >
          이 페이지는 검토용 제안 공유본입니다 — 시공 확정 문서가 아니며, 모든
          금액은 가정(allowance) 단가 기준입니다.
        </p>

        {project.concept_image_url && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- 저장된 컨셉 이미지 */}
            <img
              src={project.concept_image_url}
              alt="AI 부스 컨셉 이미지"
              className="w-full"
            />
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white">
              AI 컨셉 — 시공 기준 아님
            </span>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-black">부스 개요</p>
          <ul className="mt-2 space-y-1 text-sm text-black/70">
            <li>
              · 치수:{" "}
              {confirmed ? (
                <b>
                  {confirmed.widthM}m × {confirmed.depthM}m · 높이{" "}
                  {confirmed.wallHeightM}m (확정)
                </b>
              ) : (
                <>
                  {footprint?.selected?.label ?? `${project.area_input}${project.area_unit === "sqm" ? "㎡" : "ft²"}`}{" "}
                  <span className="font-semibold text-amber-700">
                    (가정 — 치수 확정 전)
                  </span>
                </>
              )}
            </li>
            {event?.eventName && <li>· 행사: {event.eventName}</li>}
            {event?.venue && <li>· 장소: {event.venue}</li>}
            {event?.boothNumber && <li>· 부스 번호: {event.boothNumber}</li>}
            {officialServices && hasOfficialServicesInput(officialServices) && (
              <li>
                · 공식 서비스:{" "}
                {[
                  officialServices.powerApplied && "전기",
                  officialServices.riggingApplied && "리깅",
                  officialServices.internetApplied && "인터넷",
                ]
                  .filter(Boolean)
                  .join(" · ") || "메모만"}{" "}
                신청됨
                {officialServices.note && (
                  <span className="text-black/45"> — {officialServices.note}</span>
                )}
              </li>
            )}
            {brand && (
              <li className="flex items-center gap-2">
                · 브랜드: <b>{brand.name ?? "확정됨"}</b>
                {brand.colorHex && (
                  <span
                    aria-label={`브랜드 컬러 ${brand.colorHex}`}
                    className="inline-block h-4 w-4 rounded-full border border-black/15 align-middle"
                    style={{ backgroundColor: brand.colorHex }}
                  />
                )}
              </li>
            )}
          </ul>
          {componentCounts.size > 0 && (
            <>
              <p className="mt-3 text-xs font-bold text-black/60">구성 요소</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {Array.from(componentCounts.entries()).map(([catalogId, count]) => (
                  <li
                    key={catalogId}
                    className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-black/65"
                  >
                    {findCatalogItem(catalogId)?.nameKo ?? catalogId} × {count}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {(estimate || range) && (
          <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-black">예상 금액</p>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  estimate ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {estimate
                  ? estimate.quotedLineCount > 0
                    ? `카탈로그 견적 · 검토 단가 ${estimate.quotedLineCount}/${estimate.directLineCount}`
                    : "카탈로그 견적 · 가정 단가"
                  : "개념 범위 · 치수 확정 전"}
              </span>
            </div>
            {estimate ? (
              <>
                <ul className="mt-2 divide-y divide-black/[0.06]">
                  {[...estimate.lines, ...estimate.markupLines].map((line) => (
                    <li
                      key={line.id}
                      className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-black/70">
                        {line.label}
                        {line.source === "quoted" && (
                          <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                            {EXPO_MONEY_SOURCE_LABELS.quoted}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums font-semibold text-black/80">
                        {formatKrw(line.amountKrw)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between border-t border-black/10 pt-2">
                  <span className="text-sm font-bold text-black">
                    합계 (부가세 별도)
                  </span>
                  <span className="tabular-nums text-lg font-bold text-blue-700">
                    {formatKrw(estimate.totalKrw)}
                  </span>
                </div>
              </>
            ) : range ? (
              <p className="mt-2 tabular-nums text-xl font-bold text-black">
                {formatKrw(range.lowKrw)} ~ {formatKrw(range.highKrw)}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] leading-4 text-black/45">
              모든 단가는 allowance(가정) 상태로, 시공사 검토·발행 전 확정
              금액이 아닙니다. 부가세 별도.
            </p>
          </div>
        )}

        {eventItems.length > 0 && (
          <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-black">행사 규정 검토</p>
            <ul className="mt-2 space-y-1">
              {eventItems.map((item) => (
                <li
                  key={item.code}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                    item.severity === "violation"
                      ? "bg-red-50 text-red-700"
                      : item.severity === "warning"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-green-50 text-green-700"
                  }`}
                >
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ProposalDecisionForm token={token} initialDecision={clientDecision} />

        <div className="mt-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-black">제안 준비도</p>
            <span className="text-xs font-semibold text-black/45">
              참고 진행률 {readinessPercent(readiness)}%
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {readiness.map((item) => (
              <li key={item.dimension} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 font-bold text-black/70">
                  {item.label}
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-black/60">
                  {EXPO_READINESS_STATE_LABELS[item.state]}
                </span>
                <span className="min-w-0 flex-1 truncate text-black/45">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center text-[11px] text-black/35">
          INPICK EXPO · interiorpick.co.kr/expo ·{" "}
          {new Date(project.updated_at).toLocaleDateString("ko-KR")} 기준
        </p>
      </div>
    </main>
  );
}
