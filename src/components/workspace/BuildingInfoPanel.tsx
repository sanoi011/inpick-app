"use client";

import { useState, useEffect } from "react";
import { Home, Loader2, Maximize, BedDouble, Building2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { AddressSearchResult, BuildingInfo } from "@/types/address";

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

  useEffect(() => {
    setLoading(true);
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
        // 첫 번째 동 자동 확장
        const first = (data.buildings || [])[0]?.dongName;
        if (first) setExpandedDong(first);
      })
      .catch(() => setBuildings([]))
      .finally(() => setLoading(false));
  }, [selectedAddress]);

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
              <p className="text-blue-200 text-[10px] mt-0.5">{selectedBuilding.typeName}형</p>
            )}
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Maximize className="w-3.5 h-3.5 text-blue-600" />
              <div>
                <p className="text-[10px] text-gray-500">전용</p>
                <p className="text-xs font-semibold">{selectedBuilding.exclusiveArea}m²</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <BedDouble className="w-3.5 h-3.5 text-green-600" />
              <div>
                <p className="text-[10px] text-gray-500">방/욕실</p>
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
        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-[10px] text-green-700">
          실측 도면 기반 정확 데이터
        </div>
      )}
      {source === "naver_land" && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">
          네이버 부동산 데이터
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-6">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500">건물 정보를 찾을 수 없습니다</p>
          <p className="text-[10px] text-gray-400 mt-1">도면을 직접 업로드해 주세요</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
                        <p className="text-[10px] text-gray-500">
                          {unit.typeName ? `${unit.typeName}형 | ` : ""}{unit.exclusiveArea}m²
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400">{unit.floor}층</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
