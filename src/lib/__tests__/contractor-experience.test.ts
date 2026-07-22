import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContractorEvidence,
  canSubmitContractorInquiry,
  formatContractorRegion,
  getConnectionJourney,
  getContractorProfileReadiness,
  getPlacementDisclosure,
} from "../contractor-experience";

const baseContractor = {
  isVerified: false,
  isFeatured: false,
  subscriptionTier: "free" as const,
  totalReviews: 0,
  completedProjects: 0,
  portfolioThumbnails: [] as string[],
};

test("상단 노출과 사업자 확인 상태를 분리한다", () => {
  const disclosure = getPlacementDisclosure({
    ...baseContractor,
    isFeatured: true,
    subscriptionTier: "premium" as const,
  });
  assert.equal(disclosure?.label, "상단 노출");
  assert.match(disclosure?.description || "", /검증 여부와는 별개/);

  const evidence = buildContractorEvidence({
    ...baseContractor,
    isFeatured: true,
    subscriptionTier: "premium" as const,
  });
  assert.equal(evidence.some((item) => item.kind === "verified"), false);
});

test("실제 데이터가 있는 근거만 표시한다", () => {
  const evidence = buildContractorEvidence({
    ...baseContractor,
    isVerified: true,
    totalReviews: 4,
    completedProjects: 7,
    portfolioThumbnails: ["https://example.com/a.jpg"],
  });
  assert.deepEqual(evidence.map((item) => item.label), [
    "사업자 정보 확인",
    "리뷰 4개",
    "완료 실적 7건",
    "포트폴리오 있음",
  ]);
});

test("프로필 준비도는 여섯 개 실데이터 항목만 계산한다", () => {
  const readiness = getContractorProfileReadiness({
    companyName: "인픽 시공",
    phone: "010-0000-0000",
    region: "서울",
    introduction: "정직한 시공 과정을 기록합니다.",
    licenseNumber: "123-45-67890",
    businessLicenseUrl: "https://example.com/license.pdf",
    tradesCount: 2,
    portfolioCount: 0,
    isPublic: true,
  });
  assert.equal(readiness.completed, 5);
  assert.equal(readiness.total, 6);
  assert.equal(readiness.percent, 83);
  assert.equal(readiness.items.find((item) => item.id === "portfolio")?.complete, false);
  assert.equal(readiness.label, "프로필 준비도");
});

test("문의는 이름·연락처·공유 동의가 모두 있어야 제출할 수 있다", () => {
  assert.equal(canSubmitContractorInquiry({ consumerName: "김인픽", consumerPhone: "010-1234-5678", sharingAccepted: false }), false);
  assert.equal(canSubmitContractorInquiry({ consumerName: "김인픽", consumerPhone: "", sharingAccepted: true }), false);
  assert.equal(canSubmitContractorInquiry({ consumerName: "김인픽", consumerPhone: "010-1234-5678", sharingAccepted: true }), true);
});

test("연결 여정은 요구조건부터 동일 조건 비교까지 네 단계다", () => {
  const journey = getConnectionJourney();
  assert.equal(journey.length, 4);
  assert.equal(journey[0]?.title, "요구조건 정리");
  assert.equal(journey[3]?.title, "동일 조건 비교");
  assert.match(journey[2]?.description || "", /상세 주소/);
});

test("내부 지역 코드는 고객용 한글 이름으로 표시한다", () => {
  assert.equal(formatContractorRegion("seoul"), "서울");
  assert.equal(formatContractorRegion("daejeon"), "대전");
  assert.equal(formatContractorRegion("부산"), "부산");
});
