"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

export interface CostItem {
  id: string;
  category: string;   // 구분 (철거, 마감, 목공 등)
  part: string;        // 부위 (바닥, 벽, 천장 등)
  productName: string; // 품명
  method: string;      // 시공
  spec: string;        // 규격
  unit: string;        // 단위
  quantity: number;     // 수량
  materialCost: number; // 재료비
  laborCost: number;    // 노무비
  overhead: number;     // 경비
  total: number;        // 합계
  note?: string;        // 비고
}

export interface RoomCostSection {
  roomName: string;
  items: CostItem[];
  subtotal: number;
}

interface CostTableProps {
  sections: RoomCostSection[];
  className?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function CostTable({ sections, className = "" }: CostTableProps) {
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(
    new Set(sections.map((s) => s.roomName))
  );

  const toggleRoom = (roomName: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomName)) next.delete(roomName);
      else next.add(roomName);
      return next;
    });
  };

  const grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);

  return (
    <div className={`${className}`}>
      {sections.map((section) => {
        const isExpanded = expandedRooms.has(section.roomName);
        return (
          <div key={section.roomName} className="mb-4">
            {/* 공간 헤더 */}
            <button
              onClick={() => toggleRoom(section.roomName)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-t-lg hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-semibold text-sm">{section.roomName}</span>
                <span className="text-xs text-gray-300 ml-2">{section.items.length}항목</span>
              </div>
              <span className="font-semibold text-sm">{formatNumber(section.subtotal)}원</span>
            </button>

            {/* 상세 테이블 */}
            {isExpanded && (
              <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 w-16">구분</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 w-16">부위</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[100px]">품명</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">시공</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 w-20">규격</th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-600 w-12">단위</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-600 w-14">수량</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">재료비</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-600 w-20">노무비</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-600 w-16">경비</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-600 w-24">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                        <td className="px-2 py-2 text-gray-600">{item.category}</td>
                        <td className="px-2 py-2 text-gray-600">{item.part}</td>
                        <td className="px-2 py-2 font-medium text-gray-900">{item.productName}</td>
                        <td className="px-2 py-2 text-gray-600">{item.method}</td>
                        <td className="px-2 py-2 text-gray-500">{item.spec}</td>
                        <td className="px-2 py-2 text-center text-gray-600">{item.unit}</td>
                        <td className="px-2 py-2 text-right text-gray-900">{item.quantity}</td>
                        <td className="px-2 py-2 text-right text-gray-900">{formatNumber(item.materialCost)}</td>
                        <td className="px-2 py-2 text-right text-gray-900">{formatNumber(item.laborCost)}</td>
                        <td className="px-2 py-2 text-right text-gray-900">{formatNumber(item.overhead)}</td>
                        <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNumber(item.total)}</td>
                      </tr>
                    ))}
                    {/* 소계 */}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={7} className="px-2 py-2 text-gray-700 text-right">소계</td>
                      <td className="px-2 py-2 text-right text-gray-900">
                        {formatNumber(section.items.reduce((s, i) => s + i.materialCost, 0))}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-900">
                        {formatNumber(section.items.reduce((s, i) => s + i.laborCost, 0))}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-900">
                        {formatNumber(section.items.reduce((s, i) => s + i.overhead, 0))}
                      </td>
                      <td className="px-2 py-2 text-right text-blue-700">
                        {formatNumber(section.subtotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {/* 내역 추가 버튼 */}
                <button className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Plus className="w-3 h-3" /> 내역 추가
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 총합계 */}
      <div className="mt-4 bg-blue-600 text-white rounded-xl px-6 py-4 flex items-center justify-between">
        <span className="font-semibold">공사비 합계 (VAT 별도)</span>
        <span className="text-2xl font-bold">{formatNumber(grandTotal)}원</span>
      </div>
    </div>
  );
}
