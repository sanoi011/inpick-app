"use client";

import { useState, useEffect } from "react";
import { Home, Loader2, Maximize, BedDouble, Building2, AlertTriangle, ChevronDown, ChevronUp, Edit3, Search, ImageIcon } from "lucide-react";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";

interface PyeongOption {
  pyeongNo: number;
  pyeongName: string;
  exclusiveArea: number;
  supplyArea: number;
  roomCnt: number;
  bathroomCnt: number;
  grandPlanUrl: string | null;
  hasFloorPlan: boolean;
}

interface Props {
  selectedAddress: AddressSearchResult;
  onSelectBuilding: (building: BuildingInfo) => void;
  selectedBuilding: BuildingInfo | null;
}

export default function BuildingInfoPanel({ selectedAddress, onSelectBuilding, selectedBuilding }: Props) {
  const [buildings, setBuildings] = useState<BuildingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("");
  const [expandedDong, setExpandedDong] = useState<string | null>(null);

  // 수동 입력 상태
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualDong, setManualDong] = useState("");
  const [manualHo, setManualHo] = useState("");
  const [pyeongList, setPyeongList] = useState<PyeongOption[]>([]);
  const [pyeongLoading, setPyeongLoading] = useState(false);
  const [manualComplexNo, setManualComplexNo] = useState("");
  const [manualComplexName, setManualComplexName] = useState("");

  useEffect(() => {
    setLoading(true);
    setShowManualInput(false);
    setPyeongList([]);
    const p = new URLSearchParams({
      sigunguCd: selectedAddress.sigunguCode,
      bjdongCd: selectedAddress.bcode ? selectedAddress.bcode.slice(5) : "",
      bcode: selectedAddress.bcode || "",
      address: selectedAddress.roadAddress,
      buildingName: selectedAddress.buildingName || "",
    });
    fetch(`/api/building?${p}`)
      .then((res) => res.json())
      .then((data) => {
        setBuildings(data.buildings || []);
        setSource(data.source || "");
        const first = (data.buildings || [])[0]?.dongName;
        if (first) setExpandedDong(first);
      })
      .catch(() => setBuildings([]))
      .finally(() => setLoading(false));
  }, [selectedAddress]);

  // 수동 입력: 평형 타입 검색
  const handleSearchPyeong = async () => {
    if (!manualDong || !manualHo) return;
    setPyeongLoading(true);
    try {
      const p = new URLSearchParams({
        mode: "manual",
        bcode: selectedAddress.bcode || "",
        buildingName: selectedAddress.buildingName || "",
        dong: manualDong.replace(/동$/, ""),
        ho: manualHo.replace(/호$/, ""),
      });
      const res = await fetch(`/api/building?${p}`);
      const data = await res.json();
      setPyeongList(data.pyeongList || []);
      setManualComplexNo(data.complexNo || "");
      setManualComplexName(data.complexName || "");
    } catch {
      setPyeongList([]);
    } finally {
      setPyeongLoading(false);
    }
  };

  // 평형 선택 → BuildingInfo 생성
  const handleSelectPyeong = (pyeong: PyeongOption) => {
    const dongNum = manualDong.replace(/동$/, "");
    const hoNum = manualHo.replace(/호$/, "");
    const floor = parseInt(hoNum.slice(0, -2)) || 1;

    const building: BuildingInfo = {
      id: `manual-${dongNum}-${hoNum}`,
      address: selectedAddress.roadAddress,
      buildingName: selectedAddress.buildingName || manualComplexName,
      dongName: `${dongNum}동`,
      hoName: `${hoNum}호`,
      buildingType: "아파트",
      totalFloor: 25,
      floor,
      exclusiveArea: pyeong.exclusiveArea,
      supplyArea: pyeong.supplyArea,
      roomCount: pyeong.roomCnt,
      bathroomCount: pyeong.bathroomCnt,
      floorPlanAvailable: pyeong.hasFloorPlan,
      typeName: pyeong.pyeongName,
      complexName: manualComplexName,
      complexNo: manualComplexNo,
      pyeongNo: pyeong.pyeongNo,
      grandPlanUrl: pyeong.grandPlanUrl || undefined,
    };
    onSelectBuilding(building);
  };

  // 동별 그룹핑
  const groupedByDong = buildings.reduce<Record<string, BuildingInfo[]>>((acc, b) => {
    const key = b.dongName || "기본";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  if (selectedBuilding) {
    return (
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-blue-600 px-3 py-2">
            <p className="text-white text-xs font-medium truncate">
              {selectedAddress.buildingName} {selectedBuilding.dongName} {selectedBuilding.hoName}
            </p>
            {selectedBuilding.typeName && (
              <p className="text-blue-200 text-xs mt-0.5">{selectedBuilding.typeName}형</p>
            )}
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Maximize className="w-3.5 h-3.5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">전용</p>
                <p className="text-xs font-semibold">{selectedBuilding.exclusiveArea}m²</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <BedDouble className="w-3.5 h-3.5 text-green-600" />
              <div>
                <p className="text-xs text-gray-500">방/욕실</p>
                <p className="text-xs font-semibold">{selectedBuilding.roomCount || "?"}방 {selectedBuilding.bathroomCount || "?"}욕</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => onSelectBuilding(null as unknown as BuildingInfo)}
            className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-2 border-t border-gray-100"
          >
            다른 동/호 선택
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
        <Building2 className="w-4 h-4" /> 동/호 선택
      </h3>

      {source === "known_apartment" && (
        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          실측 도면 기반 정확 데이터
        </div>
      )}
      {(source === "naver_land" || source === "naver_land_cache") && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          네이버 부동산 데이터
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : buildings.length === 0 ? (
        <div>
          {!showManualInput ? (
            <div className="text-center py-4">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-3">건물 정보를 찾을 수 없습니다</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="flex items-center gap-1.5 mx-auto px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                동/호수 직접 입력
              </button>
            </div>
          ) : (
            <ManualInputSection
              manualDong={manualDong}
              manualHo={manualHo}
              setManualDong={setManualDong}
              setManualHo={setManualHo}
              onSearch={handleSearchPyeong}
              pyeongLoading={pyeongLoading}
              pyeongList={pyeongList}
              manualComplexName={manualComplexName}
              onSelectPyeong={handleSelectPyeong}
              onCancel={() => setShowManualInput(false)}
            />
          )}
        </div>
      ) : (
        <div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {Object.entries(groupedByDong).map(([dong, units]) => (
              <div key={dong} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedDong(expandedDong === dong ? null : dong)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-700">{dong} ({units.length})</span>
                  {expandedDong === dong ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                {expandedDong === dong && (
                  <div className="divide-y divide-gray-100">
                    {units.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => onSelectBuilding(unit)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-3"
                      >
                        <Home className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">{unit.hoName}</p>
                          <p className="text-xs text-gray-500">
                            {unit.typeName ? `${unit.typeName}형 | ` : ""}{unit.exclusiveArea}m²
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">{unit.floor}층</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* 수동 입력 토글 (건물 있어도 다른 동/호 직접 입력 가능) */}
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-blue-600 py-1.5"
          >
            <Edit3 className="w-3 h-3" />
            {showManualInput ? "목록에서 선택" : "동/호수 직접 입력"}
          </button>
          {showManualInput && (
            <ManualInputSection
              manualDong={manualDong}
              manualHo={manualHo}
              setManualDong={setManualDong}
              setManualHo={setManualHo}
              onSearch={handleSearchPyeong}
              pyeongLoading={pyeongLoading}
              pyeongList={pyeongList}
              manualComplexName={manualComplexName}
              onSelectPyeong={handleSelectPyeong}
              onCancel={() => setShowManualInput(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ManualInputSection({
  manualDong,
  manualHo,
  setManualDong,
  setManualHo,
  onSearch,
  pyeongLoading,
  pyeongList,
  manualComplexName,
  onSelectPyeong,
  onCancel,
}: {
  manualDong: string;
  manualHo: string;
  setManualDong: (v: string) => void;
  setManualHo: (v: string) => void;
  onSearch: () => void;
  pyeongLoading: boolean;
  pyeongList: PyeongOption[];
  manualComplexName: string;
  onSelectPyeong: (p: PyeongOption) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">동</label>
          <input
            type="text"
            value={manualDong}
            onChange={(e) => setManualDong(e.target.value)}
            placeholder="203"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">호</label>
          <input
            type="text"
            value={manualHo}
            onChange={(e) => setManualHo(e.target.value)}
            placeholder="1202"
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSearch}
          disabled={!manualDong || !manualHo || pyeongLoading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {pyeongLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          평형 타입 검색
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
        >
          취소
        </button>
      </div>

      {/* 평형 리스트 */}
      {pyeongList.length > 0 && (
        <div>
          {manualComplexName && (
            <p className="text-xs text-gray-500 mb-1.5 font-medium">{manualComplexName}</p>
          )}
          <div className="space-y-1.5">
            {pyeongList.map((p) => (
              <button
                key={p.pyeongNo}
                onClick={() => onSelectPyeong(p)}
                className="w-full p-2.5 text-left border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {p.pyeongName}평형
                    </p>
                    <p className="text-xs text-gray-500">
                      전용 {p.exclusiveArea}m² · {p.roomCnt}방 {p.bathroomCnt}욕
                    </p>
                  </div>
                  {p.hasFloorPlan ? (
                    <span className="flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      <ImageIcon className="w-3 h-3" />
                      도면
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">도면없음</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {pyeongList.length === 0 && !pyeongLoading && manualComplexName && (
        <p className="text-xs text-gray-400 text-center py-2">평형 정보를 찾을 수 없습니다</p>
      )}
    </div>
  );
}
