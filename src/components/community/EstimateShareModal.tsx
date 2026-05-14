"use client";

/**
 * EstimateShareModal — Step3 견적을 커뮤니티에 공유하는 모달.
 * 가이드: §4-1
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Share2, ShieldCheck } from "lucide-react";
import { DEFAULT_VISIBILITY_V2, type CommunityShareVisibilityV2 } from "@/types/community-v2";

interface Props {
  open: boolean;
  projectId: string;
  estimateContextId?: string;
  estimateId?: string;
  /** 기본 제목/본문 자동 생성용 힌트 */
  hints?: {
    areaLabel?: string;
    regionLabel?: string;
    totalAmountRangeLabel?: string;
    buildingType?: string;
  };
  onClose: () => void;
}

const VISIBILITY_OPTIONS: Array<{
  key: keyof CommunityShareVisibilityV2;
  label: string;
  description: string;
}> = [
  { key: "showDesignImages", label: "디자인 이미지", description: "AI 생성 시안" },
  { key: "showTotalAmount", label: "총 견적금액", description: "단, 정확한 금액 대신 범위로 표시됨" },
  { key: "showTradeSummary", label: "공종별 합계", description: "17공종 합계 미니 테이블" },
  { key: "showDetailedLines", label: "공종별 상세 금액", description: "재료비/노무비/경비 분해" },
  { key: "showBrandSku", label: "자재 브랜드/SKU", description: "제조사, 모델명 등" },
];

export default function EstimateShareModal({
  open,
  projectId,
  estimateContextId,
  estimateId,
  hints,
  onClose,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(autoTitle(hints));
  const [content, setContent] = useState(autoContent(hints));
  const [visibility, setVisibility] = useState<CommunityShareVisibilityV2>(DEFAULT_VISIBILITY_V2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setError("제목과 본문을 입력해주세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/community/share-from-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          estimateContextId,
          estimateId,
          boardSlug: "estimate-share",
          title,
          content,
          visibility,
          snapshotType: "estimate_share",
        }),
      });
      const data = await res.json();
      if (res.ok && data.postId) {
        onClose();
        router.push(`/community/posts/${data.postId}`);
      } else {
        setError(data.hint || data.error || "공유 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5E2DD] px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[#202123]" />
            <h2 className="text-base font-bold text-[#202123]">커뮤니티에 견적 공유</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#9A9A9A] hover:bg-[#F0EFEC]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-[#F0EFEC] p-3 text-xs text-[#3F3F46]">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1F6B2A]" />
            <div>
              <p className="font-semibold text-[#202123]">개인정보 자동 제거</p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-[#6B6B6B]">
                정확한 주소·동/호수·연락처·도면 원본·결제 정보는 자동으로 가려집니다. 지역은 시/구
                수준, 면적은 평수대로만 표시됩니다.
              </p>
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">공개 범위</label>
            <div className="space-y-1.5">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 hover:bg-[#F7F7F5]"
                >
                  <input
                    type="checkbox"
                    checked={visibility[opt.key]}
                    onChange={(e) =>
                      setVisibility((v) => ({ ...v, [opt.key]: e.target.checked }))
                    }
                    className="mt-0.5 h-3.5 w-3.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-[#202123]">{opt.label}</p>
                    <p className="text-[0.65rem] text-[#9A9A9A]">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] focus:border-[#202123] focus:outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-[#3F3F46]">본문</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-[#E5E2DD] bg-white px-3 py-2 text-sm text-[#202123] focus:border-[#202123] focus:outline-none"
            />
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E5E2DD] bg-[#FAF9F7] px-5 py-3">
          <button onClick={onClose} className="text-sm text-[#6B6B6B] hover:text-[#202123]">
            취소
          </button>
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#202123] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 게시 중…
              </>
            ) : (
              "게시하기"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function autoTitle(hints?: Props["hints"]): string {
  const areaPart = hints?.areaLabel ? `${hints.areaLabel} ` : "";
  const buildingPart = hints?.buildingType ?? "아파트";
  const amountPart = hints?.totalAmountRangeLabel
    ? ` 견적 ${hints.totalAmountRangeLabel}`
    : " 견적";
  return `${areaPart}${buildingPart} 리모델링${amountPart}, 적정한가요?`;
}

function autoContent(hints?: Props["hints"]): string {
  return `안녕하세요. INPICK으로 디자인과 견적을 받아봤는데 의견 부탁드립니다.

${hints?.regionLabel ? `· 지역: ${hints.regionLabel}\n` : ""}${hints?.buildingType ? `· 공간 유형: ${hints.buildingType}\n` : ""}${hints?.areaLabel ? `· 면적: ${hints.areaLabel}\n` : ""}${hints?.totalAmountRangeLabel ? `· 총 견적: ${hints.totalAmountRangeLabel}\n` : ""}

궁금한 점:
1. 전체 견적이 적정한지 봐주세요.
2. 특정 공종 금액이 높거나 낮은 부분이 있으면 의견 부탁드립니다.
3. 비슷한 공사 해보신 분 경험 공유 환영합니다.

※ 정확한 주소와 개인정보는 비공개 처리되었습니다.`;
}
