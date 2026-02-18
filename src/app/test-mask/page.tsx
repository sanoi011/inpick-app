"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 테스트용 페이지: 세그멘테이션 마스크가 적용된 프로젝트를 localStorage에 세팅하고
 * 렌더링 페이지로 리다이렉트
 */
export default function TestMaskPage() {
  const router = useRouter();
  const [status, setStatus] = useState("세팅 중...");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [urls, setUrls] = useState<{ clean: string; mask: string } | null>(null);

  const PROJECT_ID = "test-mask-viewer";

  useEffect(() => {
    async function setup() {
      try {
        setStatus("DB에서 마스크 데이터 조회 중...");
        const res = await fetch(
          `/api/project/generate-floorplan?complexNo=6165&pyeongNo=3`
        );
        const data = await res.json();

        if (!data.exists) {
          setError(
            "생성된 도면이 없습니다. 먼저 node scripts/test-e2e-mask.mjs 를 실행하세요."
          );
          return;
        }

        if (!data.maskUrl) {
          setError("마스크가 없습니다. 도면을 재생성하세요.");
          return;
        }

        setStatus("테스트 프로젝트 데이터 세팅 중...");
        const now = new Date().toISOString();
        const project = {
          id: PROJECT_ID,
          status: "RENDERING",
          address: {
            roadAddress: "대전 유성구 용산동",
            jibunAddress: "대전 유성구 용산동",
            buildingName: "샘물타운",
            floor: "4",
            area: 84.94,
          },
          design: {
            images: [],
            decisions: [],
            chatMessages: [],
            generatedImages: [],
          },
          floorPlanImageUrl: data.finalUrl,
          floorPlanMaskUrl: data.maskUrl,
          roomColorMap: data.roomColorMap,
          createdAt: now,
          updatedAt: now,
        };

        localStorage.setItem(
          `inpick_project_${PROJECT_ID}`,
          JSON.stringify(project)
        );

        setUrls({ clean: data.finalUrl, mask: data.maskUrl });
        setStatus("준비 완료!");
        setReady(true);
      } catch (err) {
        setError((err as Error).message);
      }
    }

    setup();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-lg w-full">
        <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">
          세그멘테이션 마스크 테스트
        </h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          샘물타운 105평형 (84.94m²)
        </p>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        ) : !ready ? (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">{status}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 미리보기 */}
            {urls && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 text-center">
                    클린 도면
                  </p>
                  <img
                    src={urls.clean}
                    alt="Clean"
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 text-center">
                    세그멘테이션 마스크
                  </p>
                  <img
                    src={urls.mask}
                    alt="Mask"
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}

            {/* 버튼 */}
            <button
              onClick={() =>
                router.push(`/project/${PROJECT_ID}/rendering`)
              }
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              렌더링 페이지에서 자재 오버레이 확인
            </button>

            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              렌더링 페이지에서 바닥재/타일 등 자재를 선택하면
              <br />
              해당 방 영역에 선택한 자재 색상이 오버레이됩니다.
              <br />
              방을 클릭하면 해당 공종 카테고리로 자동 전환됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
