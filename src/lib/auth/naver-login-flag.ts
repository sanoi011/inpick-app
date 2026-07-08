/**
 * 네이버 로그인 노출 플래그.
 *
 * 2026-05 네이버 로그인 검수 반려 → 2026-07 재신청 진행 중. 검수 통과 전까지
 * authorize가 즉시 오류 207("서비스 설정 오류")로 떨어져 전 사용자 로그인 불가
 * → 버튼 자체를 숨김 (Apple 심사 2.1 기능오류 리젝 방지 겸용).
 *
 * 재노출: 네이버 검수 통과 후 Vercel env NEXT_PUBLIC_ENABLE_NAVER_LOGIN=true.
 * ⚠️ iOS는 allowNavigation에 nid.naver.com이 포함된 빌드(6 이상)에서만 인앱 완결됨.
 *    빌드 5 이하에서 켜면 외부 Safari로 이탈 — Apple Guideline 4 리젝 사유(2026-07-07).
 */
export const NAVER_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_NAVER_LOGIN === "true";
