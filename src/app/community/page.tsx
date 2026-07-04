/**
 * /community — 커뮤니티 v2 피드 (인스타/X 스타일 단일 컬럼).
 *
 * 목적(2026-07-04 재정의): ①우리 집·AI 프로젝트 자랑 ②이웃 피드백 ③서비스 피드백 수집.
 * 구식 3단 게시판 셸 → FeedV2로 전면 교체. 게시판별 보기는 /community/boards/[slug] 유지.
 */
import FeedV2 from "@/components/community/FeedV2";

export default function CommunityHomePage() {
  return <FeedV2 />;
}
