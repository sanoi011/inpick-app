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

export default function FloorPlan2D({ floorPlan, selectedRoomId, onRoomClick, className = "" }: FloorPlan2DProps) {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  // 전체 바운딩박스 계산
  const allPositions = floorPlan.rooms.map((r) => r.position);
  const minX = Math.min(...allPositions.map((p) => p.x));
  const minY = Math.min(...allPositions.map((p) => p.y));
  const maxX = Math.max(...allPositions.map((p) => p.x + p.width));
  const maxY = Math.max(...allPositions.map((p) => p.y + p.height));

  const padding = 0.5;
  const viewMinX = minX - padding;
  const viewMinY = minY - padding;
  const viewWidth = maxX - minX + padding * 2;
  const viewHeight = maxY - minY + padding * 2;

  const scale = 50; // 1m = 50px

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

          return (
            <g key={room.id}
              onClick={() => onRoomClick?.(room)}
              onMouseEnter={() => setHoveredRoom(room.id)}
              onMouseLeave={() => setHoveredRoom(null)}
              className="cursor-pointer"
            >
              <rect
                x={room.position.x * scale}
                y={room.position.y * scale}
                width={room.position.width * scale}
                height={room.position.height * scale}
                fill={fillColor}
                stroke={isSelected ? "#2563EB" : isHovered ? "#60A5FA" : "#D1D5DB"}
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                rx={2}
              />
              {/* Room label */}
              <text
                x={(room.position.x + room.position.width / 2) * scale}
                y={(room.position.y + room.position.height / 2 - 0.2) * scale}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-semibold"
                fill="#374151"
                fontSize={room.position.width * scale > 100 ? 12 : 10}
              >
                {room.name}
              </text>
              {/* Area label */}
              <text
                x={(room.position.x + room.position.width / 2) * scale}
                y={(room.position.y + room.position.height / 2 + 0.4) * scale}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9CA3AF"
                fontSize={room.position.width * scale > 100 ? 10 : 8}
              >
                {room.area}m²
              </text>
            </g>
          );
        })}

        {/* Walls */}
        {floorPlan.walls.filter((w) => w.isExterior).map((wall) => (
          <line
            key={wall.id}
            x1={wall.start.x * scale}
            y1={wall.start.y * scale}
            x2={wall.end.x * scale}
            y2={wall.end.y * scale}
            stroke="#1F2937"
            strokeWidth={wall.thickness * scale}
            strokeLinecap="round"
          />
        ))}

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
