"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, ArrowRight, MapPin, Loader2, Home, ArrowLeft, Bath, BedDouble, Maximize } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";

type Step = "search" | "building" | "confirm";

export default function AddressPage() {
  const [step, setStep] = useState<Step>("search");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  // 주소 검색
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
    setStep("building");
    setBuildingLoading(true);

    try {
      const params = new URLSearchParams({
        sigunguCd: addr.sigunguCode,
        bjdongCd: addr.bcode ? addr.bcode.slice(5) : "",
        address: addr.roadAddress,
        buildingName: addr.buildingName || "",
      });
      const res = await fetch(`/api/building?${params}`);
      const data = await res.json();
      setBuildings(data.buildings || []);
    } catch {
      setBuildings([]);
    } finally {
      setBuildingLoading(false);
    }
  };

  // 건물 선택
  const handleSelectBuilding = (building: BuildingInfo) => {
    setSelectedBuilding(building);
    setStep("confirm");
  };

  // 다음 단계로
  const handleNext = () => {
    if (selectedAddress && selectedBuilding) {
      const params = new URLSearchParams({
        address: selectedAddress.roadAddress,
        zipNo: selectedAddress.zipCode,
        bdNm: selectedAddress.buildingName || "",
        dong: selectedBuilding.dongName,
        ho: selectedBuilding.hoName,
        area: String(selectedBuilding.exclusiveArea),
        rooms: String(selectedBuilding.roomCount || 0),
        baths: String(selectedBuilding.bathroomCount || 0),
        type: selectedBuilding.buildingType,
      });
      router.push(`/consult?${params.toString()}`);
    }
  };

  const handleBack = () => {
    if (step === "confirm") {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {step !== "search" && (
          <button onClick={handleBack} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
        <div className="flex items-center gap-2 ml-auto">
          <span className={`text-xs px-2 py-1 rounded-full ${step === "search" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>1. 주소</span>
          <span className={`text-xs px-2 py-1 rounded-full ${step === "building" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>2. 건물</span>
          <span className={`text-xs px-2 py-1 rounded-full ${step === "confirm" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>3. 확인</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">

          {/* Step 1: 주소 검색 */}
          {step === "search" && (
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">주소를 입력해주세요</h1>
              <p className="text-gray-500 mt-2 mb-8">인테리어할 공간의 주소를 검색하면 건물 정보를 자동으로 불러옵니다</p>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                {loading && <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />}
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setSelectedAddress(null); }}
                  placeholder="도로명 주소 또는 건물명을 입력하세요"
                  className="w-full pl-12 pr-12 py-4 rounded-xl border border-gray-300 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />

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
            </div>
          )}

          {/* Step 2: 건물 정보 선택 */}
          {step === "building" && selectedAddress && (
            <div>
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
                  <button onClick={handleNext} className="mt-4 text-sm text-blue-600 hover:underline">
                    건물 정보 없이 상담 진행하기
                  </button>
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

          {/* Step 3: 확인 */}
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
                        <p className="text-sm font-semibold text-gray-900">{selectedBuilding.exclusiveArea}m² ({(selectedBuilding.exclusiveArea * 0.3025).toFixed(1)}평)</p>
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
                      <p className="text-sm font-medium text-gray-900">{selectedBuilding.floorPlanAvailable ? "있음" : "없음"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                AI 상담 시작하기 <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
