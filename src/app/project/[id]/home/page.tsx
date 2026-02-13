"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search, Building2, ArrowRight, MapPin, Loader2, Home,
  ArrowLeft, Bath, BedDouble, Maximize, CheckCircle2,
  Smartphone, Camera, PenTool, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { useProjectState } from "@/hooks/useProjectState";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";
import type { ParsedFloorPlan } from "@/types/floorplan";
import { getSampleTypes, loadFloorPlan } from "@/lib/services/drawing-service";
import type { DrawingCatalogEntry, SampleFloorPlanType } from "@/lib/services/drawing-service";
import FloorPlan2D from "@/components/viewer/FloorPlan2D";

type Step = "search" | "building" | "confirm";

const RECENT_ADDRESSES_KEY = "inpick_recent_addresses";
const MAX_RECENT = 5;

function loadRecentAddresses(): AddressSearchResult[] {
  try {
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentAddress(addr: AddressSearchResult) {
  try {
    const recent = loadRecentAddresses();
    // 중복 제거 후 맨 앞에 추가
    const filtered = recent.filter((r) => r.roadAddress !== addr.roadAddress);
    const updated = [addr, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(updated));
  } catch {
    // 저장 실패 무시
  }
}

export default function ProjectHomePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { project, updateAddress, setDrawingId } = useProjectState(projectId);

  const [step, setStep] = useState<Step>("search");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [matchedDrawing, setMatchedDrawing] = useState<DrawingCatalogEntry | null>(null);
  const [matchedFloorPlan, setMatchedFloorPlan] = useState<ParsedFloorPlan | null>(null);
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState<AddressSearchResult[]>([]);
  const [sampleTypes, setSampleTypes] = useState<SampleFloorPlanType[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [drawingError, setDrawingError] = useState<string | null>(null);
  const [showScanOptions, setShowScanOptions] = useState(false);

  // 이미 주소가 설정된 프로젝트면 confirm 단계로
  useEffect(() => {
    if (project?.address) {
      setStep("confirm");
    }
  }, [project]);

  // 주소 검색 (디바운스)
  const searchAddress = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/address?keyword=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) {
        setResults([]);
        setTotalCount(0);
      } else {
        setResults(data.results || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim().length >= 2 && step === "search") {
        searchAddress(keyword);
      } else {
        setResults([]);
        setTotalCount(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, searchAddress, step]);

  // 주소 선택 → 건물 정보 조회
  const handleSelectAddress = async (addr: AddressSearchResult) => {
    setSelectedAddress(addr);
    setKeyword(addr.roadAddress);
    setResults([]);
    setShowRecent(false);
    saveRecentAddress(addr);
    setStep("building");
    setBuildingLoading(true);
    try {
      const p = new URLSearchParams({
        sigunguCd: addr.sigunguCode,
        bjdongCd: addr.bcode ? addr.bcode.slice(5) : "",
        address: addr.roadAddress,
        buildingName: addr.buildingName || "",
      });
      const res = await fetch(`/api/building?${p}`);
      const data = await res.json();
      setBuildings(data.buildings || []);
    } catch {
      setBuildings([]);
    } finally {
      setBuildingLoading(false);
    }
  };

  const handleSelectBuilding = async (building: BuildingInfo) => {
    setSelectedBuilding(building);
    setStep("confirm");
    setDrawingError(null);

    // 샘플 도면 타입 로드
    setDrawingLoading(true);
    try {
      const samples = await getSampleTypes();
      setSampleTypes(samples);
      // 면적 기준 자동 선택: 70㎡ 이하 → 59, 그 이상 → 84A
      if (samples.length > 0) {
        const autoId = building.exclusiveArea <= 70
          ? samples.find(s => s.id === "sample-59")?.id
          : samples.find(s => s.id === "sample-84a")?.id;
        const pickId = autoId || samples[0].id;
        setSelectedSampleId(pickId);
        const picked = samples.find(s => s.id === pickId)!;
        setMatchedDrawing(picked);
        const plan = await loadFloorPlan(pickId);
        if (!plan) {
          setDrawingError("도면 데이터를 불러올 수 없습니다. 다른 타입을 선택하거나 직접 업로드해주세요.");
        }
        setMatchedFloorPlan(plan);
      }
    } catch {
      setDrawingError("도면 카탈로그 로딩에 실패했습니다.");
    } finally {
      setDrawingLoading(false);
    }
  };

  const handleSelectSampleType = async (sample: SampleFloorPlanType) => {
    setSelectedSampleId(sample.id);
    setMatchedDrawing(sample);
    setDrawingLoading(true);
    setDrawingError(null);
    try {
      const plan = await loadFloorPlan(sample.id);
      if (!plan) {
        setDrawingError("도면 데이터를 불러올 수 없습니다.");
      }
      setMatchedFloorPlan(plan);
    } catch {
      setMatchedFloorPlan(null);
      setDrawingError("도면 로딩 중 오류가 발생했습니다.");
    } finally {
      setDrawingLoading(false);
    }
  };

  // 확인 → 프로젝트에 주소 저장 → 디자인 탭 이동
  const handleConfirm = () => {
    if (selectedAddress && selectedBuilding) {
      updateAddress({
        roadAddress: selectedAddress.roadAddress,
        zipCode: selectedAddress.zipCode,
        buildingName: selectedAddress.buildingName,
        dongName: selectedBuilding.dongName,
        hoName: selectedBuilding.hoName,
        exclusiveArea: selectedBuilding.exclusiveArea,
        supplyArea: selectedBuilding.supplyArea,
        roomCount: selectedBuilding.roomCount || 3,
        bathroomCount: selectedBuilding.bathroomCount || 1,
        buildingType: selectedBuilding.buildingType,
        floor: selectedBuilding.floor,
        totalFloor: selectedBuilding.totalFloor,
      });
      if (matchedDrawing) {
        setDrawingId(matchedDrawing.id);
      }
      router.push(`/project/${projectId}/design`);
    }
  };

  // 이미 주소 설정된 경우 바로 다음 단계로 갈 수 있게
  const handleGoDesign = () => {
    router.push(`/project/${projectId}/design`);
  };

  const handleBack = () => {
    if (step === "confirm" && !project?.address) {
      setStep("building");
      setSelectedBuilding(null);
    } else if (step === "building") {
      setStep("search");
      setSelectedAddress(null);
      setBuildings([]);
    }
  };

  // 동별 그룹핑
  const groupedByDong = buildings.reduce<Record<string, BuildingInfo[]>>((acc, b) => {
    const key = b.dongName || "기본";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        {/* 진행 상태 표시 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["search", "building", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s ? "bg-blue-600 text-white" : s === "confirm" && project?.address ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}
              `}>
                {s === "confirm" && project?.address ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </span>
              <span className={`text-sm font-medium ${step === s ? "text-blue-700" : "text-gray-400"}`}>
                {s === "search" ? "주소 검색" : s === "building" ? "건물 선택" : "확인"}
              </span>
              {i < 2 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* 이미 주소가 설정된 경우 */}
        {step === "confirm" && project?.address && !selectedBuilding && (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">주소가 설정되어 있습니다</h2>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 mt-6">
              <div className="bg-blue-600 px-6 py-4">
                <p className="text-white font-medium">{project.address.roadAddress}</p>
                <p className="text-blue-200 text-sm mt-1">
                  {project.address.buildingName} {project.address.dongName} {project.address.hoName}
                </p>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Maximize className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">전용면적</p>
                    <p className="text-sm font-semibold">{project.address.exclusiveArea}m² ({(project.address.exclusiveArea * 0.3025).toFixed(1)}평)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <BedDouble className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">방/욕실</p>
                    <p className="text-sm font-semibold">{project.address.roomCount}방 / {project.address.bathroomCount}욕실</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("search"); }}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                주소 변경
              </button>
              <button
                onClick={handleGoDesign}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                디자인하기 <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: 주소 검색 */}
        {step === "search" && (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">우리집 찾기</h1>
            <p className="text-gray-500 mt-2 mb-8">인테리어할 공간의 주소를 검색하세요</p>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              {loading && <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />}
              <input
                type="text"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setSelectedAddress(null); setShowRecent(false); }}
                onDoubleClick={() => {
                  if (keyword.trim().length === 0) {
                    const recent = loadRecentAddresses();
                    setRecentAddresses(recent);
                    if (recent.length > 0) setShowRecent(true);
                  }
                }}
                onBlur={() => { setTimeout(() => setShowRecent(false), 200); }}
                placeholder="도로명 주소 또는 건물명을 입력하세요"
                className="w-full pl-12 pr-12 py-4 rounded-xl border border-gray-300 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />

              {/* 최근 검색 주소 (더블클릭 시) */}
              {showRecent && recentAddresses.length > 0 && results.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-80 overflow-y-auto z-10">
                  <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                    최근 검색한 주소
                  </div>
                  {recentAddresses.map((addr, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectAddress(addr)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{addr.roadAddress}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {addr.buildingName && `${addr.buildingName} | `}{addr.zipCode}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-80 overflow-y-auto z-10">
                  <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                    검색결과 {totalCount.toLocaleString()}건
                  </div>
                  {results.map((addr, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectAddress(addr)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{addr.roadAddress}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {addr.jibunAddress} {addr.buildingName && `| ${addr.buildingName}`} [{addr.zipCode}]
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-6 border border-gray-200 text-left">
                <Building2 className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900">아파트 / 빌라</h3>
                <p className="text-sm text-gray-500 mt-1">공동주택 도면 자동 조회</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 text-left">
                <Building2 className="w-8 h-8 text-indigo-600 mb-3" />
                <h3 className="font-semibold text-gray-900">상가 / 사무실</h3>
                <p className="text-sm text-gray-500 mt-1">상업공간 맞춤 견적</p>
              </div>
            </div>

            {/* 3D 도면 안내 */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">안내:</span> 3D 도면은 실측 도면 바탕으로 구축되었으나 일부 오차가 있을 수 있습니다.
                실제 건축 도면이 확보되면 더욱 정확한 서비스가 제공됩니다.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 건물 정보 선택 */}
        {step === "building" && selectedAddress && (
          <div>
            <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
              <ArrowLeft className="w-4 h-4" /> 주소 다시 검색
            </button>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
              <p className="text-sm font-medium text-blue-900">{selectedAddress.roadAddress}</p>
              <p className="text-xs text-blue-600 mt-1">
                {selectedAddress.buildingName && `${selectedAddress.buildingName} | `}{selectedAddress.zipCode}
              </p>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">동/호를 선택해주세요</h2>
            <p className="text-gray-500 mb-6 text-sm">건물 정보를 선택하면 면적과 공간 구성을 자동으로 파악합니다</p>

            {buildingLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : Object.keys(groupedByDong).length === 0 ? (
              <div className="text-center py-12">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">건물 정보를 불러올 수 없습니다</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByDong).map(([dong, units]) => (
                  <div key={dong}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">{dong}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {units.map((unit) => (
                        <button
                          key={unit.id}
                          onClick={() => handleSelectBuilding(unit)}
                          className="w-full bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left flex items-center gap-4"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{unit.hoName}</p>
                            <p className="text-xs text-gray-500">{unit.buildingType} | {unit.floor}층</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-gray-900">{unit.exclusiveArea}m²</p>
                            <p className="text-xs text-gray-400">{(unit.exclusiveArea * 0.3025).toFixed(1)}평</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: 확인 (새로 선택한 경우) */}
        {step === "confirm" && selectedAddress && selectedBuilding && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">선택한 공간 정보를 확인해주세요</h2>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
              <div className="bg-blue-600 px-6 py-4">
                <p className="text-white font-medium">{selectedAddress.roadAddress}</p>
                <p className="text-blue-200 text-sm mt-1">
                  {selectedAddress.buildingName && `${selectedAddress.buildingName} `}
                  {selectedBuilding.dongName} {selectedBuilding.hoName}
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Maximize className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">전용면적</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedBuilding.exclusiveArea}m² ({(selectedBuilding.exclusiveArea * 0.3025).toFixed(1)}평)
                      </p>
                    </div>
                  </div>
                  {selectedBuilding.supplyArea && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">공급면적</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedBuilding.supplyArea}m²</p>
                      </div>
                    </div>
                  )}
                  {selectedBuilding.roomCount && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <BedDouble className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-xs text-gray-500">방</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedBuilding.roomCount}개</p>
                      </div>
                    </div>
                  )}
                  {selectedBuilding.bathroomCount && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Bath className="w-5 h-5 text-cyan-600" />
                      <div>
                        <p className="text-xs text-gray-500">욕실</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedBuilding.bathroomCount}개</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400">건물유형</p>
                    <p className="text-sm font-medium text-gray-900">{selectedBuilding.buildingType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">층수</p>
                    <p className="text-sm font-medium text-gray-900">{selectedBuilding.floor}층 / {selectedBuilding.totalFloor}층</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">도면</p>
                    <p className="text-sm font-medium text-gray-900">{matchedDrawing ? "AI 매칭" : selectedBuilding.floorPlanAvailable ? "있음" : "없음"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 샘플 도면 타입 선택 */}
            {sampleTypes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 text-left">도면 타입을 선택하세요</h3>
                <div className="grid grid-cols-3 gap-3">
                  {sampleTypes.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectSampleType(sample)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selectedSampleId === sample.id
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                      }`}
                    >
                      {selectedSampleId === sample.id && (
                        <CheckCircle2 className="absolute top-2 right-2 w-5 h-5 text-blue-600" />
                      )}
                      <p className="text-lg font-bold text-gray-900">{sample.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{sample.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <span>{sample.totalArea}m²</span>
                        <span>({(sample.totalArea * 0.3025).toFixed(0)}평)</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 선택된 도면 미리보기 */}
            {drawingLoading && (
              <div className="flex items-center justify-center py-8 bg-white rounded-2xl border border-gray-200 mb-6">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">도면 로딩 중...</span>
              </div>
            )}
            {!drawingLoading && matchedFloorPlan && matchedDrawing && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    실시공 건축도면 기반
                  </span>
                  <span className="text-xs text-gray-400">
                    {matchedDrawing.totalArea}m² / {matchedDrawing.roomCount}방 / {matchedDrawing.bathroomCount}욕실
                  </span>
                </div>
                <div className="h-[340px]">
                  <FloorPlan2D floorPlan={matchedFloorPlan} className="h-full" />
                </div>
              </div>
            )}
            {!drawingLoading && !matchedFloorPlan && drawingError && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">{drawingError}</p>
                  <p className="text-xs text-amber-600 mt-1">아래 &quot;도면이 없으신가요?&quot;에서 직접 업로드할 수 있습니다.</p>
                </div>
              </div>
            )}

            {/* 도면이 없으신가요? - 대체 입력 방식 */}
            <div className="mb-6">
              <button
                onClick={() => setShowScanOptions(!showScanOptions)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">도면이 없으신가요? 직접 스캔하거나 촬영하세요</span>
                {showScanOptions ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {showScanOptions && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      if (selectedAddress && selectedBuilding) {
                        updateAddress({
                          roadAddress: selectedAddress.roadAddress,
                          zipCode: selectedAddress.zipCode,
                          buildingName: selectedAddress.buildingName,
                          dongName: selectedBuilding.dongName,
                          hoName: selectedBuilding.hoName,
                          exclusiveArea: selectedBuilding.exclusiveArea,
                          supplyArea: selectedBuilding.supplyArea,
                          roomCount: selectedBuilding.roomCount || 3,
                          bathroomCount: selectedBuilding.bathroomCount || 1,
                          buildingType: selectedBuilding.buildingType,
                          floor: selectedBuilding.floor,
                          totalFloor: selectedBuilding.totalFloor,
                        });
                      }
                      router.push(`/project/${projectId}/design?mode=lidar`);
                    }}
                    className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-violet-400 hover:shadow-sm transition-all text-left"
                  >
                    <Smartphone className="w-7 h-7 text-violet-600 mb-2" />
                    <p className="text-sm font-bold text-gray-900">LiDAR 스캔</p>
                    <p className="text-xs text-gray-500 mt-1">iPhone/iPad로 직접 스캔 (가장 정확)</p>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAddress && selectedBuilding) {
                        updateAddress({
                          roadAddress: selectedAddress.roadAddress,
                          zipCode: selectedAddress.zipCode,
                          buildingName: selectedAddress.buildingName,
                          dongName: selectedBuilding.dongName,
                          hoName: selectedBuilding.hoName,
                          exclusiveArea: selectedBuilding.exclusiveArea,
                          supplyArea: selectedBuilding.supplyArea,
                          roomCount: selectedBuilding.roomCount || 3,
                          bathroomCount: selectedBuilding.bathroomCount || 1,
                          buildingType: selectedBuilding.buildingType,
                          floor: selectedBuilding.floor,
                          totalFloor: selectedBuilding.totalFloor,
                        });
                      }
                      router.push(`/project/${projectId}/design?mode=photo`);
                    }}
                    className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-emerald-400 hover:shadow-sm transition-all text-left"
                  >
                    <Camera className="w-7 h-7 text-emerald-600 mb-2" />
                    <p className="text-sm font-bold text-gray-900">사진 촬영</p>
                    <p className="text-xs text-gray-500 mt-1">방 사진 10~20장으로 AI가 도면 생성</p>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAddress && selectedBuilding) {
                        updateAddress({
                          roadAddress: selectedAddress.roadAddress,
                          zipCode: selectedAddress.zipCode,
                          buildingName: selectedAddress.buildingName,
                          dongName: selectedBuilding.dongName,
                          hoName: selectedBuilding.hoName,
                          exclusiveArea: selectedBuilding.exclusiveArea,
                          supplyArea: selectedBuilding.supplyArea,
                          roomCount: selectedBuilding.roomCount || 3,
                          bathroomCount: selectedBuilding.bathroomCount || 1,
                          buildingType: selectedBuilding.buildingType,
                          floor: selectedBuilding.floor,
                          totalFloor: selectedBuilding.totalFloor,
                        });
                      }
                      router.push(`/project/${projectId}/design?mode=hand-drawing`);
                    }}
                    className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all text-left"
                  >
                    <PenTool className="w-7 h-7 text-amber-600 mb-2" />
                    <p className="text-sm font-bold text-gray-900">손도면 촬영</p>
                    <p className="text-xs text-gray-500 mt-1">종이에 그린 도면을 사진으로 변환</p>
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 px-6 py-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                다시 선택
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                선택된 도면으로 우리집 꾸미기 시작 <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
