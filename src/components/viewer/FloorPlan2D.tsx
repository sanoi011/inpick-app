"use client";

import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { ParsedFloorPlan, RoomData, WallData, DoorData, WindowData, FixtureData } from "@/types/floorplan";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import { ENG_COLORS, VIEWER_SCALE } from "@/lib/floor-plan/viewer-constants";

// ─── Types ───────────────────────────────────────────

interface FloorPlan2DProps {
  floorPlan: ParsedFloorPlan;
  selectedRoomId?: string;
  onRoomClick?: (room: RoomData) => void;
  className?: string;
  showDimensions?: boolean;
  showFixtures?: boolean;
}

export interface FloorPlan2DHandle {
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

// ─── Helpers ─────────────────────────────────────────

function polygonCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / points.length, y: cy / points.length };
}

function computeBounds(floorPlan: ParsedFloorPlan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of floorPlan.rooms) {
    if (room.polygon && room.polygon.length > 0) {
      for (const p of room.polygon) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
    } else {
      const pos = room.position;
      if (pos.x < minX) minX = pos.x; if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.width > maxX) maxX = pos.x + pos.width;
      if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
    }
  }
  return { minX, minY, maxX, maxY };
}

// ─── SVG Sub-components ──────────────────────────────

function WallSegmentSVG({ wall, scale }: { wall: WallData; scale: number }) {
  if (wall.polygon && wall.polygon.length >= 3) {
    return (
      <polygon
        points={wall.polygon.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
        fill={wall.isExterior ? ENG_COLORS.WALL_EXTERIOR : ENG_COLORS.WALL_INTERIOR}
        stroke={ENG_COLORS.WALL_STROKE}
        strokeWidth={0.5}
        strokeLinejoin="miter"
      />
    );
  }

  const thickness = Math.max(wall.thickness || 0.15, 0.12);
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);

  const pts = [
    `${(wall.start.x + nx) * scale},${(wall.start.y + ny) * scale}`,
    `${(wall.end.x + nx) * scale},${(wall.end.y + ny) * scale}`,
    `${(wall.end.x - nx) * scale},${(wall.end.y - ny) * scale}`,
    `${(wall.start.x - nx) * scale},${(wall.start.y - ny) * scale}`,
  ];

  return (
    <polygon
      points={pts.join(" ")}
      fill={wall.isExterior ? ENG_COLORS.WALL_EXTERIOR : ENG_COLORS.WALL_INTERIOR}
      stroke={ENG_COLORS.WALL_STROKE}
      strokeWidth={0.5}
      strokeLinejoin="miter"
    />
  );
}

function WallCornerJoins({ walls, scale }: { walls: WallData[]; scale: number }) {
  const corners: { x: number; y: number; isExterior: boolean }[] = [];
  const tolerance = 0.05;

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const pairs: [{ x: number; y: number }, { x: number; y: number }][] = [
        [walls[i].end, walls[j].start],
        [walls[i].start, walls[j].end],
        [walls[i].end, walls[j].end],
        [walls[i].start, walls[j].start],
      ];
      for (const [a, b] of pairs) {
        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        if (dist < tolerance) {
          corners.push({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            isExterior: walls[i].isExterior || walls[j].isExterior,
          });
        }
      }
    }
  }

  const t = 0.16;
  return (
    <>
      {corners.map((p, i) => (
        <rect
          key={`corner-${i}`}
          x={(p.x - t / 2) * scale}
          y={(p.y - t / 2) * scale}
          width={t * scale}
          height={t * scale}
          fill={p.isExterior ? ENG_COLORS.WALL_EXTERIOR : ENG_COLORS.WALL_INTERIOR}
        />
      ))}
    </>
  );
}

function DoorSVG({ door, scale }: { door: DoorData; scale: number }) {
  const cx = door.position.x * scale;
  const cy = door.position.y * scale;
  const w = door.width * scale;
  const rot = (door.rotation || 0) * (Math.PI / 180);

  if (door.type === "sliding") {
    const arrowLen = w * 0.6;
    const endX = cx + arrowLen * Math.cos(rot);
    const endY = cy + arrowLen * Math.sin(rot);
    return (
      <g>
        <line x1={cx} y1={cy} x2={endX} y2={endY}
          stroke={ENG_COLORS.DOOR_ARC} strokeWidth={1.5} markerEnd="url(#arrowhead)" />
      </g>
    );
  }

  if (door.type === "folding") {
    return (
      <line
        x1={(door.position.x - door.width / 2) * scale} y1={cy}
        x2={(door.position.x + door.width / 2) * scale} y2={cy}
        stroke={ENG_COLORS.DOOR_ARC} strokeWidth={1.5} strokeDasharray="4 2" />
    );
  }

  // swing door (default)
  const arcRadius = w;
  const startAngle = rot;
  const endAngle = rot + Math.PI / 2;
  const arcStartX = cx + arcRadius * Math.cos(startAngle);
  const arcStartY = cy + arcRadius * Math.sin(startAngle);
  const arcEndX = cx + arcRadius * Math.cos(endAngle);
  const arcEndY = cy + arcRadius * Math.sin(endAngle);

  return (
    <g>
      <line x1={cx} y1={cy} x2={arcEndX} y2={arcEndY}
        stroke={ENG_COLORS.DOOR_LEAF} strokeWidth={1.5} strokeLinecap="round" />
      <path
        d={`M ${arcStartX} ${arcStartY} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEndX} ${arcEndY}`}
        fill="none" stroke={ENG_COLORS.DOOR_ARC} strokeWidth={0.8} strokeDasharray="3 2" />
    </g>
  );
}

function WindowSVG({ win, scale }: { win: WindowData; scale: number }) {
  const cx = win.position.x * scale;
  const cy = win.position.y * scale;
  const w = win.width * scale;
  const rot = (win.rotation || 0) * (Math.PI / 180);
  const thickness = 0.08 * scale;
  const nx = -Math.sin(rot) * thickness / 2;
  const ny = Math.cos(rot) * thickness / 2;
  const halfW = w / 2;
  const dx = Math.cos(rot) * halfW;
  const dy = Math.sin(rot) * halfW;

  return (
    <g>
      <line x1={cx - dx + nx} y1={cy - dy + ny} x2={cx + dx + nx} y2={cy + dy + ny}
        stroke={ENG_COLORS.WINDOW_FRAME} strokeWidth={1.5} />
      <line x1={cx - dx - nx} y1={cy - dy - ny} x2={cx + dx - nx} y2={cy + dy - ny}
        stroke={ENG_COLORS.WINDOW_FRAME} strokeWidth={1.5} />
      <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy}
        stroke={ENG_COLORS.WINDOW_GLASS} strokeWidth={0.5} />
    </g>
  );
}

function DimensionLines({ walls, scale, bounds }: {
  walls: WallData[];
  scale: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}) {
  const exteriorWalls = walls.filter((w) => w.isExterior);

  // 벽이 없는 경우 바운딩박스에서 합성 치수선
  const targetWalls = exteriorWalls.length > 0 ? exteriorWalls : [
    { id: "synth-top", start: { x: bounds.minX, y: bounds.minY }, end: { x: bounds.maxX, y: bounds.minY }, thickness: 0.15, isExterior: true } as WallData,
    { id: "synth-right", start: { x: bounds.maxX, y: bounds.minY }, end: { x: bounds.maxX, y: bounds.maxY }, thickness: 0.15, isExterior: true } as WallData,
    { id: "synth-bottom", start: { x: bounds.maxX, y: bounds.maxY }, end: { x: bounds.minX, y: bounds.maxY }, thickness: 0.15, isExterior: true } as WallData,
    { id: "synth-left", start: { x: bounds.minX, y: bounds.maxY }, end: { x: bounds.minX, y: bounds.minY }, thickness: 0.15, isExterior: true } as WallData,
  ];

  const dimOffset = 0.5; // meters offset from wall

  return (
    <g>
      {targetWalls.map((wall) => {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.3) return null;

        // Normal pointing outward (heuristic: away from center)
        const midX = (bounds.minX + bounds.maxX) / 2;
        const midY = (bounds.minY + bounds.maxY) / 2;
        let nx = -dy / len;
        let ny = dx / len;
        const wallMidX = (wall.start.x + wall.end.x) / 2;
        const wallMidY = (wall.start.y + wall.end.y) / 2;
        const dotToCenter = (wallMidX + nx - midX) ** 2 + (wallMidY + ny - midY) ** 2;
        const dotAwayCenter = (wallMidX - nx - midX) ** 2 + (wallMidY - ny - midY) ** 2;
        if (dotToCenter < dotAwayCenter) { nx = -nx; ny = -ny; }

        const sx = (wall.start.x + nx * dimOffset) * scale;
        const sy = (wall.start.y + ny * dimOffset) * scale;
        const ex = (wall.end.x + nx * dimOffset) * scale;
        const ey = (wall.end.y + ny * dimOffset) * scale;
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        const lengthMM = Math.round(len * 1000);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const tickLen = 4;
        const tnx = -Math.sin(angle * Math.PI / 180) * tickLen;
        const tny = Math.cos(angle * Math.PI / 180) * tickLen;

        return (
          <g key={wall.id + "-dim"}>
            <line x1={sx} y1={sy} x2={ex} y2={ey}
              stroke={ENG_COLORS.DIMENSION_LINE} strokeWidth={0.5} />
            <line x1={sx - tnx} y1={sy - tny} x2={sx + tnx} y2={sy + tny}
              stroke={ENG_COLORS.DIMENSION_LINE} strokeWidth={0.5} />
            <line x1={ex - tnx} y1={ey - tny} x2={ex + tnx} y2={ey + tny}
              stroke={ENG_COLORS.DIMENSION_LINE} strokeWidth={0.5} />
            <line x1={wall.start.x * scale} y1={wall.start.y * scale} x2={sx} y2={sy}
              stroke={ENG_COLORS.DIMENSION_LINE} strokeWidth={0.3} strokeDasharray="2 2" />
            <line x1={wall.end.x * scale} y1={wall.end.y * scale} x2={ex} y2={ey}
              stroke={ENG_COLORS.DIMENSION_LINE} strokeWidth={0.3} strokeDasharray="2 2" />
            <text x={mx} y={my - 3} textAnchor="middle" dominantBaseline="auto"
              fill={ENG_COLORS.DIMENSION_TEXT} fontSize={8} fontWeight={500}
              transform={`rotate(${angle}, ${mx}, ${my - 3})`}>
              {lengthMM.toLocaleString()}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function FixtureSVG({ fixture, scale }: { fixture: FixtureData; scale: number }) {
  const x = fixture.position.x * scale;
  const y = fixture.position.y * scale;
  const w = fixture.position.width * scale;
  const h = fixture.position.height * scale;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const stroke = ENG_COLORS.FIXTURE_STROKE;
  const fill = ENG_COLORS.FIXTURE_FILL;
  const sw = 0.8;

  switch (fixture.type) {
    case "toilet":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h * 0.3}
            fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />
          <ellipse cx={cx} cy={y + h * 0.65} rx={w * 0.4} ry={h * 0.3}
            fill={fill} stroke={stroke} strokeWidth={sw} />
        </g>
      );
    case "sink":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h}
            fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />
          <path
            d={`M ${x + w * 0.15} ${cy} A ${w * 0.35} ${h * 0.35} 0 0 0 ${x + w * 0.85} ${cy}`}
            fill="none" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={y + h * 0.2} r={1.5} fill={stroke} />
        </g>
      );
    case "kitchen_sink":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h}
            fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />
          <rect x={x + w * 0.08} y={y + h * 0.15} width={w * 0.38} height={h * 0.7}
            fill="none" stroke={stroke} strokeWidth={0.5} rx={1} />
          <rect x={x + w * 0.54} y={y + h * 0.15} width={w * 0.38} height={h * 0.7}
            fill="none" stroke={stroke} strokeWidth={0.5} rx={1} />
        </g>
      );
    case "bathtub":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h}
            fill={fill} stroke={stroke} strokeWidth={sw} rx={w * 0.15} />
          <rect x={x + w * 0.08} y={y + h * 0.08} width={w * 0.84} height={h * 0.84}
            fill="none" stroke={stroke} strokeWidth={0.5} rx={w * 0.12} />
        </g>
      );
    case "stove":
      return (
        <g>
          <rect x={x} y={y} width={w} height={h}
            fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />
          {[0, 1, 2, 3].map((i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const bx = x + w * (0.28 + col * 0.44);
            const by = y + h * (0.28 + row * 0.44);
            const r = Math.min(w, h) * 0.13;
            return <circle key={i} cx={bx} cy={by} r={r} fill="none" stroke={stroke} strokeWidth={0.5} />;
          })}
        </g>
      );
    default:
      return (
        <rect x={x} y={y} width={w} height={h}
          fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />
      );
  }
}

// ─── Main Component ──────────────────────────────────

const FloorPlan2D = forwardRef<FloorPlan2DHandle, FloorPlan2DProps>(function FloorPlan2D(
  { floorPlan, selectedRoomId, onRoomClick, className = "", showDimensions = true, showFixtures = true },
  ref
) {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const scale = VIEWER_SCALE;
  const bounds = computeBounds(floorPlan);
  const padding = 0.8;

  const defaultVB = {
    x: (bounds.minX - padding) * scale,
    y: (bounds.minY - padding) * scale,
    w: (bounds.maxX - bounds.minX + padding * 2) * scale,
    h: (bounds.maxY - bounds.minY + padding * 2) * scale,
  };

  const [viewBox, setViewBox] = useState(defaultVB);

  useEffect(() => {
    setViewBox({
      x: (bounds.minX - padding) * scale,
      y: (bounds.minY - padding) * scale,
      w: (bounds.maxX - bounds.minX + padding * 2) * scale,
      h: (bounds.maxY - bounds.minY + padding * 2) * scale,
    });
  }, [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, scale]);

  const resetView = useCallback(() => {
    setViewBox({
      x: (bounds.minX - padding) * scale,
      y: (bounds.minY - padding) * scale,
      w: (bounds.maxX - bounds.minX + padding * 2) * scale,
      h: (bounds.maxY - bounds.minY + padding * 2) * scale,
    });
  }, [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, scale]);

  const zoomBy = useCallback((factor: number) => {
    setViewBox((prev) => {
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  }, []);

  useImperativeHandle(ref, () => ({
    resetView,
    zoomIn: () => zoomBy(0.8),
    zoomOut: () => zoomBy(1.25),
  }), [resetView, zoomBy]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = (e.clientY - rect.top) / rect.height;
    setViewBox((prev) => {
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      return {
        x: prev.x + (prev.w - newW) * mouseX,
        y: prev.y + (prev.h - newH) * mouseY,
        w: newW,
        h: newH,
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - panStart.x) / rect.width) * viewBox.w;
    const dy = ((e.clientY - panStart.y) / rect.height) * viewBox.h;
    setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [isPanning, panStart, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const hasPolygons = floorPlan.rooms.some((r) => r.polygon && r.polygon.length > 0);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full flex-1"
        style={{ minHeight: "300px", cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 1. Grid */}
        <defs>
          <pattern id="grid" width={scale} height={scale} patternUnits="userSpaceOnUse">
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke={ENG_COLORS.GRID_LINE} strokeWidth="0.5" />
          </pattern>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={ENG_COLORS.DOOR_ARC} />
          </marker>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill={ENG_COLORS.BACKGROUND} />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#grid)" />

        {/* 2. Room fills */}
        {floorPlan.rooms.map((room) => {
          const isSelected = room.id === selectedRoomId;
          const isHovered = room.id === hoveredRoom;
          const fillColor = isSelected
            ? ENG_COLORS.SELECTED_FILL
            : ENG_COLORS.ROOM_FILLS[room.type] || "rgba(215, 215, 215, 0.35)";
          const strokeColor = isSelected ? ENG_COLORS.SELECTED_STROKE : isHovered ? ENG_COLORS.HOVER_STROKE : "transparent";
          const strokeW = isSelected ? 2 : isHovered ? 1.5 : 0;
          const usePolygon = room.polygon && room.polygon.length >= 3;

          return (
            <g
              key={`room-${room.id}`}
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
            </g>
          );
        })}

        {/* 3. Fixtures */}
        {showFixtures && floorPlan.fixtures?.map((fixture) => (
          <FixtureSVG key={fixture.id} fixture={fixture} scale={scale} />
        ))}

        {/* 4. Walls (on top of rooms) */}
        {floorPlan.walls.map((wall) => (
          <WallSegmentSVG key={wall.id} wall={wall} scale={scale} />
        ))}
        {floorPlan.walls.length > 0 && (
          <WallCornerJoins walls={floorPlan.walls} scale={scale} />
        )}

        {/* 5. Doors */}
        {floorPlan.doors.map((door) => (
          <DoorSVG key={door.id} door={door} scale={scale} />
        ))}

        {/* 5b. Windows */}
        {floorPlan.windows.map((win) => (
          <WindowSVG key={win.id} win={win} scale={scale} />
        ))}

        {/* 6. Dimension lines */}
        {showDimensions && (
          <DimensionLines walls={floorPlan.walls} scale={scale} bounds={bounds} />
        )}

        {/* 7. Room labels (on top of everything) */}
        {floorPlan.rooms.map((room) => {
          const usePolygon = room.polygon && room.polygon.length >= 3;
          let labelX: number, labelY: number, roomW: number;
          if (usePolygon) {
            const c = polygonCentroid(room.polygon!);
            labelX = c.x * scale;
            labelY = c.y * scale;
            roomW = room.position.width;
          } else {
            labelX = (room.position.x + room.position.width / 2) * scale;
            labelY = (room.position.y + room.position.height / 2) * scale;
            roomW = room.position.width;
          }
          const fontSize = roomW * scale > 100 ? 12 : roomW * scale > 60 ? 10 : 8;
          const areaFontSize = fontSize - 2;
          if (roomW * scale < 30) return null;

          return (
            <g key={`label-${room.id}`} pointerEvents="none">
              <text x={labelX} y={labelY - areaFontSize * 0.4}
                textAnchor="middle" dominantBaseline="middle"
                fill={ENG_COLORS.LABEL_NAME} fontSize={fontSize} fontWeight="600">
                {room.name}
              </text>
              <text x={labelX} y={labelY + fontSize * 0.7}
                textAnchor="middle" dominantBaseline="middle"
                fill={ENG_COLORS.LABEL_AREA} fontSize={areaFontSize}>
                {room.area}m²
              </text>
            </g>
          );
        })}

        {/* 8. Badge */}
        {hasPolygons && (
          <g>
            <rect x={viewBox.x + 8} y={viewBox.y + 8} width={115} height={22} rx={4}
              fill={ENG_COLORS.BADGE_BG} fillOpacity={0.95} />
            <text x={viewBox.x + 65} y={viewBox.y + 20}
              textAnchor="middle" dominantBaseline="middle"
              fill={ENG_COLORS.BADGE_TEXT} fontSize={9} fontWeight="600">
              INPICK 구조분석
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap gap-3">
        {floorPlan.rooms
          .filter((r, i, arr) => arr.findIndex((a) => a.type === r.type) === i)
          .map((room) => {
            const color = ENG_COLORS.ROOM_FILLS[room.type] || "rgba(215,215,215,0.35)";
            return (
              <div key={room.type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.type] || room.type}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
});

export default FloorPlan2D;
