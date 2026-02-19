"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

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
  editable?: boolean;
  onAddItem?: (sectionName: string) => void;
  onDeleteItem?: (sectionName: string, itemId: string) => void;
  onEditPrice?: (sectionName: string, itemId: string, field: 'materialCost' | 'laborCost', value: number) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function CostTable({
  sections,
  className = "",
  editable = false,
  onAddItem,
  onDeleteItem,
  onEditPrice,
}: CostTableProps) {
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
  const totalMat = sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + i.materialCost, 0), 0);
  const totalLab = sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + i.laborCost, 0), 0);
  const totalOvh = sections.reduce((s, sec) => s + sec.items.reduce((a, i) => a + i.overhead, 0), 0);
  return (
    <div className={`${className}`}>
      {sections.map((section) => {
        const isExpanded = expandedRooms.has(section.roomName);
        const secMat = section.items.reduce((s, i) => s + i.materialCost, 0);
        const secLab = section.items.reduce((s, i) => s + i.laborCost, 0);
        const secOvh = section.items.reduce((s, i) => s + i.overhead, 0);

        return (
          <div key={section.roomName} className="mb-3">
            {/* 공간 헤더 — 네이비 */}
            <button
              onClick={() => toggleRoom(section.roomName)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-700 text-white rounded-t-md hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-bold text-sm tracking-tight">{section.roomName}</span>
                <span className="text-[11px] text-slate-300 ml-1">{section.items.length}건</span>
              </div>
              <span className="font-bold text-sm tabular-nums">{formatNumber(section.subtotal)}원</span>
            </button>

            {/* 상세 테이블 */}
            {isExpanded && (
              <div className="border border-slate-300 border-t-0 rounded-b-md overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-300">
                      {onDeleteItem && <th className="px-1 py-2.5 w-8 border-r border-slate-200"></th>}
                      <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-[52px] border-r border-slate-200">번호</th>
                      <th className="px-2 py-2.5 text-left font-bold text-slate-700 w-[72px] border-r border-slate-200">구분</th>
                      <th className="px-2 py-2.5 text-left font-bold text-slate-700 min-w-[120px] border-r border-slate-200">품명</th>
                      <th className="px-2 py-2.5 text-left font-bold text-slate-700 min-w-[100px] border-r border-slate-200">규격</th>
                      <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-[44px] border-r border-slate-200">단위</th>
                      <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-[56px] border-r border-slate-200">수량</th>
                      <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-[80px] border-r border-slate-200">재료비</th>
                      <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-[80px] border-r border-slate-200">노무비</th>
                      <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-[68px] border-r border-slate-200">경비</th>
                      <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-[92px]">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-200 hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                      >
                        {onDeleteItem && (
                          <td className="px-1 py-2 text-center border-r border-slate-200">
                            <button
                              onClick={() => onDeleteItem(section.roomName, item.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                              title="항목 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-2 text-center text-slate-400 tabular-nums border-r border-slate-200">{idx + 1}</td>
                        <td className="px-2 py-2 text-slate-600 border-r border-slate-200">{item.category}</td>
                        <td className="px-2 py-2 font-medium text-slate-900 border-r border-slate-200">{item.productName}</td>
                        <td className="px-2 py-2 text-slate-500 text-[11px] border-r border-slate-200 truncate max-w-[160px]" title={item.spec}>{item.spec}</td>
                        <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-200">{item.unit}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-900 border-r border-slate-200">{item.quantity}</td>
                        {editable ? (
                          <>
                            <td className="px-1 py-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={item.materialCost}
                                onChange={(e) => onEditPrice?.(section.roomName, item.id, 'materialCost', Number(e.target.value) || 0)}
                                className="w-full text-right text-xs bg-blue-50 border-2 border-blue-300 rounded px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                              />
                            </td>
                            <td className="px-1 py-1 border-r border-slate-200">
                              <input
                                type="number"
                                value={item.laborCost}
                                onChange={(e) => onEditPrice?.(section.roomName, item.id, 'laborCost', Number(e.target.value) || 0)}
                                className="w-full text-right text-xs bg-blue-50 border-2 border-blue-300 rounded px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-800 border-r border-slate-200">{formatNumber(item.materialCost)}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-800 border-r border-slate-200">{formatNumber(item.laborCost)}</td>
                          </>
                        )}
                        <td className="px-2 py-2 text-right tabular-nums text-slate-600 border-r border-slate-200">{formatNumber(item.overhead)}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-slate-900">{formatNumber(item.total)}</td>
                      </tr>
                    ))}
                    {/* 소계 */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={onDeleteItem ? 8 : 7} className="px-3 py-2.5 text-right font-bold text-slate-700 text-xs border-r border-slate-200">
                        소계
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800 text-xs border-r border-slate-200">
                        {formatNumber(secMat)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800 text-xs border-r border-slate-200">
                        {formatNumber(secLab)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800 text-xs border-r border-slate-200">
                        {formatNumber(secOvh)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-blue-700 text-sm">
                        {formatNumber(section.subtotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {/* 내역 추가 */}
                {onAddItem && (
                  <button
                    onClick={() => onAddItem(section.roomName)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-200"
                  >
                    <Plus className="w-3 h-3" /> 내역 추가
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 총합계 바 */}
      <div className="mt-4 bg-slate-800 text-white rounded-md overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-600">
          <div className="flex items-center gap-3 sm:gap-6 text-xs flex-wrap">
            <span className="text-slate-400">재료비 <span className="text-slate-200 font-semibold tabular-nums ml-1">{formatNumber(totalMat)}</span></span>
            <span className="text-slate-400">노무비 <span className="text-slate-200 font-semibold tabular-nums ml-1">{formatNumber(totalLab)}</span></span>
            <span className="text-slate-400">경비 <span className="text-slate-200 font-semibold tabular-nums ml-1">{formatNumber(totalOvh)}</span></span>
          </div>
        </div>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <span className="font-bold text-sm">공사비 합계 (VAT 별도)</span>
          <span className="text-xl font-bold tabular-nums tracking-tight">{formatNumber(grandTotal)}원</span>
        </div>
      </div>
    </div>
  );
}
