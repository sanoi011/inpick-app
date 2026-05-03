/**
 * InPick Design — 1차 기본 버전
 *
 * 흐름:
 *  1. 주소 입력 또는 평면도 업로드
 *  2. 자동 분석 → 평형 + 실별 치수 (백그라운드 저장)
 *  3. 사용자 옵션 (확장/비확장, 스타일, 자재 느낌)
 *  4. 실별 렌더 생성 (병렬)
 *  5. 자재 매핑 + 견적서
 *  6. 입면전개도 (SVG)
 *  7. PDF 출력 / 시공업자 매칭
 */
"use client";

import { useState } from "react";

interface RoomDim {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  areaM2: number;
  source: string;
}

interface AnalyzeResult {
  pyeong: string;
  exclusiveAreaM2: number;
  rooms: Record<string, RoomDim>;
  totalAreaM2: number;
  expansionVisible: boolean;
  ceilingHeightMm: number;
  source: string;
  confidence: number;
}

interface RenderResult {
  roomName: string;
  imageUrl: string;
  costUsd: number;
}

interface EstimateLine {
  surface: string;
  materialName: string;
  brand?: string;
  quantity: number;
  unit: string;
  unitPriceWon: number;
  subtotalWon: number;
  category: "main" | "aux" | "labor";
}

interface RoomEstimate {
  roomName: string;
  totalAreaM2: number;
  items: EstimateLine[];
  mainTotalWon: number;
  auxTotalWon: number;
  laborTotalWon: number;
  totalWon: number;
}

const STYLES = [
  { id: "modern_minimal", label: "모던 미니멀", desc: "깔끔·여백·무채색" },
  { id: "scandinavian", label: "스칸디나비안", desc: "밝은 톤·우드·따뜻함" },
  { id: "korean_traditional", label: "한식 전통", desc: "여백미·목재·정갈함" },
  { id: "industrial", label: "인더스트리얼", desc: "노출 콘크리트·메탈" },
  { id: "japandi", label: "재팬디", desc: "한식+일본·우드·차분" },
  { id: "luxury_classic", label: "럭셔리 클래식", desc: "대리석·골드·웅장" },
];

const FEELINGS = [
  "차분함", "따뜻함", "밝음", "고급스러움", "자연감", "아늑함",
];

export default function InPickDesignPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Step 1
  const [address, setAddress] = useState("");
  const [floorplanFile, setFloorplanFile] = useState<File | null>(null);
  const [floorplanUrl, setFloorplanUrl] = useState<string>("");
  const [exclusiveArea, setExclusiveArea] = useState<string>("");

  // Step 2 — analyze result
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);

  // Step 3 — user options
  const [expansion, setExpansion] = useState(false);
  const [style, setStyle] = useState<string>("modern_minimal");
  const [feelings, setFeelings] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);

  // Step 4 — render
  const [rendering, setRendering] = useState(false);
  const [renders, setRenders] = useState<RenderResult[]>([]);

  // Step 5 — estimate
  const [estimating, setEstimating] = useState(false);
  const [estimates, setEstimates] = useState<RoomEstimate[]>([]);
  const [grandTotal, setGrandTotal] = useState<{ totalWon: number; mainTotal: number; auxTotal: number; laborTotal: number } | null>(null);

  // Step 6 — elevation SVG URL list
  const [elevations, setElevations] = useState<{ roomName: string; svg: string }[]>([]);

  // ---------- handlers ----------
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFloorplanFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setFloorplanUrl(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleAnalyze() {
    if (!floorplanUrl) {
      alert("평면도 업로드 또는 주소 입력 후 평면도 호출 필요");
      return;
    }
    setAnalyzing(true);
    try {
      const body: any = {
        imageBase64: floorplanUrl.split(",")[1],
        imageMimeType: floorplanFile?.type || "image/jpeg",
      };
      if (exclusiveArea) body.exclusiveAreaM2 = parseFloat(exclusiveArea);
      const res = await fetch("/api/inpick/analyze-floorplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalyzeResult(data);
      setSelectedRooms(Object.keys(data.rooms).filter((n) => !n.includes("발코니") && !n.includes("현관")));
      setStep(3);
    } catch (e: any) {
      alert("분석 실패: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleRender() {
    if (!analyzeResult || selectedRooms.length === 0) return;
    setRendering(true);
    setStep(4);
    const styleLabel = STYLES.find((s) => s.id === style)?.label || style;
    const feelStr = feelings.join(", ");
    const results: RenderResult[] = [];

    for (const roomName of selectedRooms) {
      const dim = analyzeResult.rooms[roomName];
      try {
        const res = await fetch("/api/inpick/render-room", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            widthMm: dim.widthMm,
            depthMm: dim.depthMm,
            heightMm: dim.heightMm,
            style: styleLabel,
            feeling: feelStr,
            expansion,
          }),
        });
        const data = await res.json();
        if (data.imageUrl) {
          results.push({ roomName, imageUrl: data.imageUrl, costUsd: data.costUsd || 0 });
          setRenders([...results]);
        }
      } catch (e) {
        console.error("render fail", roomName, e);
      }
    }
    setRendering(false);
  }

  async function handleEstimate() {
    if (renders.length === 0 || !analyzeResult) return;
    setEstimating(true);
    setStep(5);
    try {
      const rooms = renders.map((r) => ({
        roomName: r.roomName,
        dim: analyzeResult.rooms[r.roomName],
        renderImageUrl: r.imageUrl,
      }));
      const res = await fetch("/api/inpick/build-estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstimates(data.estimates);
      setGrandTotal(data.grandTotal);
    } catch (e: any) {
      alert("견적 실패: " + e.message);
    } finally {
      setEstimating(false);
    }
  }

  async function handleElevation() {
    if (!analyzeResult) return;
    setStep(6);
    const results: { roomName: string; svg: string }[] = [];
    for (const roomName of selectedRooms) {
      const dim = analyzeResult.rooms[roomName];
      try {
        const res = await fetch("/api/inpick/generate-elevation", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            widthMm: dim.widthMm,
            depthMm: dim.depthMm,
            heightMm: dim.heightMm,
          }),
        });
        const svg = await res.text();
        results.push({ roomName, svg });
        setElevations([...results]);
      } catch (e) { console.error("elevation fail", roomName, e); }
    }
  }

  // ---------- render ----------
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-3xl font-bold">🏠 InPick AI 인테리어 디자인</h1>
        <p className="text-sm text-gray-600 mt-1">
          평면도 업로드 → AI 자동 분석 → 실별 렌더 → 자재 견적 → 입면전개도
        </p>
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ AI 추정 견적입니다. 실제 시공·구매 결정 전 시공 전문가와 협의하세요.
        </p>
      </header>

      {/* Step indicator */}
      <div className="flex gap-2 text-xs">
        {["주소·평면도", "분석", "옵션", "렌더", "견적", "입면도"].map((label, i) => (
          <div
            key={i}
            className={`flex-1 text-center py-2 rounded ${step > i ? "bg-green-100" : step === i + 1 ? "bg-blue-200 font-bold" : "bg-gray-100"}`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <section className="space-y-4 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold">1단계 — 주소 또는 평면도</h2>
          <div>
            <label className="block text-sm mb-1">주소 (선택)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울시 강남구 역삼동 OOO 아파트 101동 1001호"
              className="w-full border px-3 py-2 rounded"
            />
            <p className="text-xs text-gray-500 mt-1">
              주소 입력 시 네이버 부동산 평면도 자동 호출 (워터마크 제거 파이프라인 적용)
            </p>
          </div>
          <div>
            <label className="block text-sm mb-1">또는 평면도 직접 업로드</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">전용면적 (m², 알면 정확도↑)</label>
            <input
              type="number"
              value={exclusiveArea}
              onChange={(e) => setExclusiveArea(e.target.value)}
              placeholder="예: 84.5 (30평형)"
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          {floorplanUrl && (
            <img src={floorplanUrl} alt="평면도" className="max-h-64 border rounded" />
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !floorplanUrl}
            className="w-full bg-blue-600 text-white py-3 rounded disabled:bg-gray-300"
          >
            {analyzing ? "분석 중... (10~30초)" : "평면도 분석 시작 →"}
          </button>
        </section>
      )}

      {/* STEP 3 — options */}
      {step === 3 && analyzeResult && (
        <section className="space-y-4 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold">3단계 — 디자인 옵션</h2>
          <div className="bg-blue-50 p-3 rounded text-sm">
            <strong>분석 결과</strong>: {analyzeResult.pyeong} (전용 {analyzeResult.exclusiveAreaM2}m²){" "}
            · 총 {analyzeResult.totalAreaM2}m² · 천장고 {analyzeResult.ceilingHeightMm}mm · 신뢰도 {(analyzeResult.confidence * 100).toFixed(0)}%
          </div>
          <div>
            <h3 className="font-medium mb-2">렌더 생성할 실 선택</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analyzeResult.rooms).map(([name, dim]) => (
                <label key={name} className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${selectedRooms.includes(name) ? "bg-blue-50 border-blue-400" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedRooms.includes(name)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRooms([...selectedRooms, name]);
                      else setSelectedRooms(selectedRooms.filter((n) => n !== name));
                    }}
                  />
                  <span className="text-sm">
                    <strong>{name}</strong> — {dim.widthMm}×{dim.depthMm}mm ({dim.areaM2}m²)
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">평면 확장 시공</h3>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={expansion} onChange={(e) => setExpansion(e.target.checked)} />
              <span className="text-sm">발코니 확장 등 평면 확장 적용</span>
            </label>
          </div>
          <div>
            <h3 className="font-medium mb-2">디자인 스타일</h3>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-3 border rounded text-left text-sm ${style === s.id ? "bg-blue-100 border-blue-500" : ""}`}
                >
                  <div className="font-bold">{s.label}</div>
                  <div className="text-xs text-gray-600">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">분위기 (복수 선택)</h3>
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    if (feelings.includes(f)) setFeelings(feelings.filter((x) => x !== f));
                    else setFeelings([...feelings, f]);
                  }}
                  className={`px-3 py-1 border rounded-full text-sm ${feelings.includes(f) ? "bg-amber-100 border-amber-400" : ""}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleRender}
            disabled={selectedRooms.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded disabled:bg-gray-300"
          >
            {selectedRooms.length} 개 실 렌더 생성 → (실당 약 30초, 비용 ₩100/실)
          </button>
        </section>
      )}

      {/* STEP 4 — render */}
      {step === 4 && (
        <section className="space-y-4 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold">4단계 — 렌더 이미지 생성 중</h2>
          <p className="text-sm text-gray-600">
            {renders.length} / {selectedRooms.length} 완료 {rendering ? "(생성 중...)" : "✅"}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {renders.map((r) => (
              <div key={r.roomName} className="border rounded p-3">
                <h4 className="font-medium mb-2">{r.roomName}</h4>
                <img src={r.imageUrl} alt={r.roomName} className="w-full rounded" />
              </div>
            ))}
          </div>
          {!rendering && renders.length > 0 && (
            <button
              onClick={handleEstimate}
              disabled={estimating}
              className="w-full bg-green-600 text-white py-3 rounded disabled:bg-gray-300"
            >
              {estimating ? "견적 산정 중..." : "자재 매핑 + 견적 →"}
            </button>
          )}
        </section>
      )}

      {/* STEP 5 — estimate */}
      {step === 5 && (
        <section className="space-y-4 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold">5단계 — 자재 견적</h2>
          {grandTotal && (
            <div className="bg-green-50 p-4 rounded space-y-1">
              <div className="text-2xl font-bold">총 견적: ₩{grandTotal.totalWon.toLocaleString()}</div>
              <div className="text-sm text-gray-700">
                자재 ₩{grandTotal.mainTotal.toLocaleString()} + 부자재 ₩{grandTotal.auxTotal.toLocaleString()} (10%) +
                인건비 ₩{grandTotal.laborTotal.toLocaleString()} (국토부 일위대가)
              </div>
            </div>
          )}
          {estimates.map((est) => (
            <details key={est.roomName} className="border rounded p-3">
              <summary className="cursor-pointer font-medium">
                {est.roomName} — ₩{est.totalWon.toLocaleString()} ({est.totalAreaM2}m²)
              </summary>
              <table className="w-full mt-3 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">위치</th>
                    <th className="text-left p-2">자재명</th>
                    <th className="text-right p-2">수량</th>
                    <th className="text-right p-2">단가</th>
                    <th className="text-right p-2">소계</th>
                    <th className="text-left p-2">구분</th>
                  </tr>
                </thead>
                <tbody>
                  {est.items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.surface}</td>
                      <td className="p-2">{it.materialName} {it.brand && `(${it.brand})`}</td>
                      <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                      <td className="p-2 text-right">₩{it.unitPriceWon.toLocaleString()}</td>
                      <td className="p-2 text-right font-medium">₩{it.subtotalWon.toLocaleString()}</td>
                      <td className="p-2 text-xs">
                        {it.category === "main" ? "주자재" : it.category === "aux" ? "부자재(10%)" : "인건비(일위대가)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
          {estimates.length > 0 && !estimating && (
            <button
              onClick={handleElevation}
              className="w-full bg-purple-600 text-white py-3 rounded"
            >
              입면전개도 생성 →
            </button>
          )}
        </section>
      )}

      {/* STEP 6 — elevation */}
      {step === 6 && (
        <section className="space-y-4 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold">6단계 — 입면전개도 (Loom 스타일)</h2>
          <div className="grid grid-cols-1 gap-4">
            {elevations.map((el) => (
              <div key={el.roomName} className="border rounded p-3">
                <h4 className="font-medium mb-2">{el.roomName}</h4>
                <div dangerouslySetInnerHTML={{ __html: el.svg }} />
                <button
                  onClick={() => {
                    const blob = new Blob([el.svg], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `elevation_${el.roomName}.svg`;
                    a.click();
                  }}
                  className="mt-2 text-sm text-blue-600 underline"
                >
                  ⬇ SVG 다운로드
                </button>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 p-4 rounded text-sm">
            <strong>다음 단계 (옵션)</strong>:
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>견적서 PDF 다운로드</li>
              <li>시공업자 매칭 (B2B 연결)</li>
              <li>프로 플랜 업그레이드: 렌더 클릭 → 자재 실시간 교체 (inpainting)</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
