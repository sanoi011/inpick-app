"use client";

import { useState } from "react";
import type { ParsedFloorPlan, RoomData } from "@/types/floorplan";
import { ROOM_TYPE_LABELS, ROOM_TYPE_COLORS } from "@/types/floorplan";

interface FloorPlan2DProps {
  floorPlan: ParsedFloorPlan;
  selectedRoomId?: string;
  onRoomClick?: (room: RoomData) => void;
  className?: string;
}

/** Compute centroid of a polygon */
function polygonCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  let cx = 0, cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

export default function FloorPlan2D({ floorPlan, selectedRoomId, onRoomClick, className = "" }: FloorPlan2DProps) {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  // 폴리곤 포인트 포함한 전체 바운딩박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const room of floorPlan.rooms) {
    if (room.polygon && room.polygon.length > 0) {
      for (const p of room.polygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    } else {
      const pos = room.position;
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.width > maxX) maxX = pos.x + pos.width;
      if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
    }
  }

  const padding = 0.5;
  const viewMinX = minX - padding;
  const viewMinY = minY - padding;
  const viewWidth = maxX - minX + padding * 2;
  const viewHeight = maxY - minY + padding * 2;

  const scale = 50; // 1m = 50px
  const hasPolygons = floorPlan.rooms.some((r) => r.polygon && r.polygon.length > 0);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <svg
        viewBox={`${viewMinX * scale} ${viewMinY * scale} ${viewWidth * scale} ${viewHeight * scale}`}
        className="w-full h-full"
        style={{ minHeight: "300px" }}
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width={scale} height={scale} patternUnits="userSpaceOnUse">
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={viewMinX * scale} y={viewMinY * scale} width={viewWidth * scale} height={viewHeight * scale} fill="url(#grid)" />

        {/* Rooms */}
        {floorPlan.rooms.map((room) => {
          const isSelected = room.id === selectedRoomId;
          const isHovered = room.id === hoveredRoom;
          const fillColor = ROOM_TYPE_COLORS[room.type] || "#F5F5F5";
          const strokeColor = isSelected ? "#2563EB" : isHovered ? "#60A5FA" : "#9CA3AF";
          const strokeW = isSelected ? 3 : isHovered ? 2 : 1;

          // 폴리곤이 있으면 폴리곤 렌더링
          const usePolygon = room.polygon && room.polygon.length >= 3;

          // 라벨 위치 계산
          let labelX: number, labelY: number, roomWidth: number;
          if (usePolygon) {
            const c = polygonCentroid(room.polygon!);
            labelX = c.x * scale;
            labelY = c.y * scale;
            roomWidth = room.position.width;
          } else {
            labelX = (room.position.x + room.position.width / 2) * scale;
            labelY = (room.position.y + room.position.height / 2) * scale;
            roomWidth = room.position.width;
          }

          // 폰트 크기: 공간 크기에 비례
          const fontSize = roomWidth * scale > 100 ? 12 : roomWidth * scale > 60 ? 10 : 8;
          const areaFontSize = fontSize - 2;

          return (
            <g
              key={room.id}
              onClick={() => onRoomClick?.(room)}
              onMouseEnter={() => setHoveredRoom(room.id)}
              onMouseLeave={() => setHoveredRoom(null)}
              className="cursor-pointer"
            >
              {usePolygon ? (
                <polygon
                  points={room.polygon!.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                />
              ) : (
                <rect
                  x={room.position.x * scale}
                  y={room.position.y * scale}
                  width={room.position.width * scale}
                  height={room.position.height * scale}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  rx={2}
                />
              )}

              {/* Room name */}
              <text
                x={labelX}
                y={labelY - (areaFontSize * 0.4)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#374151"
                fontSize={fontSize}
                fontWeight="600"
              >
                {room.name}
              </text>
              {/* Area */}
              <text
                x={labelX}
                y={labelY + (fontSize * 0.7)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9CA3AF"
                fontSize={areaFontSize}
              >
                {room.area}m²
              </text>
            </g>
          );
        })}

        {/* Walls */}
        {floorPlan.walls.map((wall) => {
          // 벽체 폴리곤이 있으면 폴리곤 렌더링
          if (wall.polygon && wall.polygon.length >= 3) {
            return (
              <polygon
                key={wall.id}
                points={wall.polygon.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
                fill={wall.isExterior ? "#374151" : "#9CA3AF"}
                stroke={wall.isExterior ? "#1F2937" : "#6B7280"}
                strokeWidth={0.5}
              />
            );
          }
          // 폴백: 선 렌더링
          return (
            <line
              key={wall.id}
              x1={wall.start.x * scale}
              y1={wall.start.y * scale}
              x2={wall.end.x * scale}
              y2={wall.end.y * scale}
              stroke={wall.isExterior ? "#1F2937" : "#9CA3AF"}
              strokeWidth={wall.thickness * scale}
              strokeLinecap="round"
            />
          );
        })}

        {/* Doors */}
        {floorPlan.doors.map((door) => (
          <g key={door.id}>
            <rect
              x={(door.position.x - door.width / 2) * scale}
              y={(door.position.y - 0.05) * scale}
              width={door.width * scale}
              height={0.1 * scale}
              fill="#F59E0B"
              rx={1}
            />
          </g>
        ))}

        {/* Windows */}
        {floorPlan.windows.map((win) => (
          <g key={win.id}>
            <rect
              x={(win.position.x - win.width / 2) * scale}
              y={(win.position.y - 0.06) * scale}
              width={win.width * scale}
              height={0.12 * scale}
              fill="#60A5FA"
              rx={1}
            />
          </g>
        ))}

        {/* Fixtures */}
        {floorPlan.fixtures?.map((fixture) => {
          const fx = fixture.position.x * scale;
          const fy = fixture.position.y * scale;
          const fw = fixture.position.width * scale;
          const fh = fixture.position.height * scale;

          const fixtureColors: Record<string, string> = {
            toilet: "#A3E635",
            sink: "#67E8F9",
            kitchen_sink: "#FDE047",
            bathtub: "#93C5FD",
            stove: "#FCA5A5",
          };
          const color = fixtureColors[fixture.type] || "#D1D5DB";

          return (
            <g key={fixture.id}>
              <rect
                x={fx}
                y={fy}
                width={fw}
                height={fh}
                fill={color}
                fillOpacity={0.6}
                stroke="#6B7280"
                strokeWidth={0.5}
                rx={fixture.type === "toilet" || fixture.type === "bathtub" ? fw / 4 : 1}
              />
            </g>
          );
        })}

        {/* "AI 건축도면" badge for polygon-based plans */}
        {hasPolygons && (
          <g>
            <rect
              x={(viewMinX + 0.1) * scale}
              y={(viewMinY + 0.1) * scale}
              width={105}
              height={20}
              rx={4}
              fill="#2563EB"
              fillOpacity={0.9}
            />
            <text
              x={(viewMinX + 0.1) * scale + 52}
              y={(viewMinY + 0.1) * scale + 11}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={10}
              fontWeight="600"
            >
              AI 건축도면 데이터
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-3">
        {floorPlan.rooms
          .filter((r, i, arr) => arr.findIndex((a) => a.type === r.type) === i)
          .map((room) => (
            <div key={room.type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: ROOM_TYPE_COLORS[room.type] }} />
              <span className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.type]}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
