/**
 * 호환 레이어 — 기존 import "@/hooks/useTokens" 유지하면서 Context 기반 구현 사용.
 * 신규 코드는 "@/contexts/TokensContext"에서 직접 import 권장.
 */
export { useTokens } from "@/contexts/TokensContext";
export type { TokenTransaction } from "@/contexts/TokensContext";
