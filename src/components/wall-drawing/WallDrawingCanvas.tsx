"use client";

import { useState, useCallback, useRef, useEffect, useReducer } from "react";
import type {
  DrawingPoint,
  DrawnWall,
  WallOpening,
  DetectedRoom,
  DrawingTool,
  DrawingAction,
  DrawingState,
  OpeningType,
} from "@/types/wall-drawing";
import {
  GRID_SIZE,
  DEFAULT_WALL_THICKNESS,
  OPENING_DEFAULTS,
} from "@/types/wall-drawing";
import type { RoomType, ParsedFloorPlan } from "@/types/floorplan";
import { ROOM_TYPE_LABELS } from "@/types/floorplan";
import { ENG_COLORS } from "@/lib/floor-plan/viewer-constants";
import {
  straightenLine,
  snapPoint,
  wallLength,
  wallAngle,
  wallNormal,
  pointToSegmentDistance,
  getPositionOnSegment,
  interpolateOnSegment,
  polygonCentroid,
  screenToMeters,
} from "@/lib/wall-drawing/geometry";
import { detectRooms } from "@/lib/wall-drawing/room-detector";
import { exportToFloorPlan } from "@/lib/wall-drawing/export-floorplan";

// ─── Constants ──────────────────────────────────────

const INITIAL_SCALE = 50; // 1m = 50px
const MIN_WALL_LENGTH = 0.3; // 최소 벽 길이 (미터)
const WALL_HIT_THRESHOLD = 0.25; // 벽 클릭 히트 범위 (미터)

// ─── Reducer ────────────────────────────────────────

interface ReducerState {
  current: DrawingState;
  undoStack: DrawingState[];
  redoStack: DrawingState[];
}

function createInitialState(): ReducerState {
  return {
    current: {
      walls: [],
      rooms: [],
      scale: INITIAL_SCALE,
      panOffset: { x: 40, y: 40 },
      gridEnabled: true,
      snapEnabled: true,
    },
    undoStack: [],
    redoStack: [],
  };
}

function pushUndo(state: ReducerState): ReducerState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-49), state.current],
    redoStack: [],
  };
}

function drawingReducer(state: ReducerState, action: DrawingAction): ReducerState {
  switch (action.type) {
    case "ADD_WALL": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        walls: [...next.current.walls, action.wall],
      };
      return next;
    }
    case "REMOVE_WALL": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        walls: next.current.walls.filter((w) => w.id !== action.wallId),
      };
      return next;
    }
    case "ADD_OPENING": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        walls: next.current.walls.map((w) =>
          w.id === action.wallId
            ? { ...w, openings: [...w.openings, action.opening] }
            : w
        ),
      };
      return next;
    }
    case "REMOVE_OPENING": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        walls: next.current.walls.map((w) =>
          w.id === action.wallId
            ? { ...w, openings: w.openings.filter((o) => o.id !== action.openingId) }
            : w
        ),
      };
      return next;
    }
    case "LABEL_ROOM": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        rooms: next.current.rooms.map((r) =>
          r.id === action.roomId
            ? { ...r, type: action.roomType, name: action.name }
            : r
        ),
      };
      return next;
    }
    case "SET_ROOMS": {
      return {
        ...state,
        current: { ...state.current, rooms: action.rooms },
      };
    }
    case "SET_PAN": {
      return {
        ...state,
        current: { ...state.current, panOffset: action.offset },
      };
    }
    case "SET_SCALE": {
      return {
        ...state,
        current: { ...state.current, scale: action.scale },
      };
    }
    case "TOGGLE_GRID": {
      return {
        ...state,
        current: { ...state.current, gridEnabled: !state.current.gridEnabled },
      };
    }
    case "TOGGLE_SNAP": {
      return {
        ...state,
        current: { ...state.current, snapEnabled: !state.current.snapEnabled },
      };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        current: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.current],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        current: next,
        undoStack: [...state.undoStack, state.current],
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    case "CLEAR": {
      const next = pushUndo(state);
      next.current = {
        ...next.current,
        walls: [],
        rooms: [],
      };
      return next;
    }
    default:
      return state;
  }
}

// ─── Sub-components ─────────────────────────────────

function GridPattern({ scale, gridSize }: { scale: number; gridSize: number }) {
  const gs = gridSize * scale;
  return (
    <defs>
      <pattern id="wall-drawing-grid" width={gs} height={gs} patternUnits="userSpaceOnUse">
        <circle cx={gs / 2} cy={gs / 2} r={1} fill={ENG_COLORS.GRID_LINE} />
      </pattern>
    </defs>
  );
}

function WallSVG({ wall, scale }: { wall: DrawnWall; scale: number }) {
  const t = Math.max(wall.thickness, 0.08);
  const n = wallNormal(wall);
  const ht = t / 2;

  // 개구부 영역을 제외한 벽 세그먼트들 렌더링
  const len = wallLength(wall);
  if (len < 0.01) return null;

  // 개구부가 없으면 전체 벽 렌더링
  if (wall.openings.length === 0) {
    const pts = [
      `${(wall.start.x + n.x * ht) * scale},${(wall.start.y + n.y * ht) * scale}`,
      `${(wall.end.x + n.x * ht) * scale},${(wall.end.y + n.y * ht) * scale}`,
      `${(wall.end.x - n.x * ht) * scale},${(wall.end.y - n.y * ht) * scale}`,
      `${(wall.start.x - n.x * ht) * scale},${(wall.start.y - n.y * ht) * scale}`,
    ];
    return (
      <polygon
        points={pts.join(" ")}
        fill={wall.isExterior ? ENG_COLORS.WALL_EXTERIOR : ENG_COLORS.WALL_INTERIOR}
        stroke={ENG_COLORS.WALL_STROKE}
        strokeWidth={0.5}
      />
    );
  }

  // 개구부가 있으면 세그먼트를 분할
  const segments: { tStart: number; tEnd: number }[] = [];
  const sortedOpenings = [...wall.openings].sort(
    (a, b) => a.positionOnWall - b.positionOnWall
  );

  let cursor = 0;
  for (const op of sortedOpenings) {
    const halfW = (op.width / 2) / len;
    const gapStart = Math.max(0, op.positionOnWall - halfW);
    const gapEnd = Math.min(1, op.positionOnWall + halfW);
    if (cursor < gapStart) {
      segments.push({ tStart: cursor, tEnd: gapStart });
    }
    cursor = gapEnd;
  }
  if (cursor < 1) {
    segments.push({ tStart: cursor, tEnd: 1 });
  }

  return (
    <g>
      {segments.map((seg, i) => {
        const s = interpolateOnSegment(wall.start, wall.end, seg.tStart);
        const e = interpolateOnSegment(wall.start, wall.end, seg.tEnd);
        const pts = [
          `${(s.x + n.x * ht) * scale},${(s.y + n.y * ht) * scale}`,
          `${(e.x + n.x * ht) * scale},${(e.y + n.y * ht) * scale}`,
          `${(e.x - n.x * ht) * scale},${(e.y - n.y * ht) * scale}`,
          `${(s.x - n.x * ht) * scale},${(s.y - n.y * ht) * scale}`,
        ];
        return (
          <polygon
            key={`ws-${wall.id}-${i}`}
            points={pts.join(" ")}
            fill={wall.isExterior ? ENG_COLORS.WALL_EXTERIOR : ENG_COLORS.WALL_INTERIOR}
            stroke={ENG_COLORS.WALL_STROKE}
            strokeWidth={0.5}
          />
        );
      })}
    </g>
  );
}

function OpeningSVG({
  wall,
  opening,
  scale,
}: {
  wall: DrawnWall;
  opening: WallOpening;
  scale: number;
}) {
  const pos = interpolateOnSegment(wall.start, wall.end, opening.positionOnWall);
  const angle = wallAngle(wall);
  const cx = pos.x * scale;
  const cy = pos.y * scale;
  const w = opening.width * scale;
  const isWindow = opening.type === "window" || opening.type === "large_window";

  if (isWindow) {
    // 창문: 이중 평행선 + 중앙 유리선
    const frameOffset = 3;
    return (
      <g transform={`translate(${cx},${cy}) rotate(${(angle * 180) / Math.PI})`}>
        {/* 프레임 2개 */}
        <line
          x1={-w / 2} y1={-frameOffset}
          x2={w / 2} y2={-frameOffset}
          stroke={ENG_COLORS.WINDOW_FRAME} strokeWidth={2}
        />
        <line
          x1={-w / 2} y1={frameOffset}
          x2={w / 2} y2={frameOffset}
          stroke={ENG_COLORS.WINDOW_FRAME} strokeWidth={2}
        />
        {/* 유리선 */}
        <line
          x1={-w / 2} y1={0}
          x2={w / 2} y2={0}
          stroke={ENG_COLORS.WINDOW_GLASS} strokeWidth={1}
        />
      </g>
    );
  }

  // 문: 여닫이 스윙 아크
  const isSliding = opening.type === "sliding";
  const dir = opening.swingDirection === "right" ? 1 : -1;

  if (isSliding) {
    // 미닫이: 화살표 선
    return (
      <g transform={`translate(${cx},${cy}) rotate(${(angle * 180) / Math.PI})`}>
        <line
          x1={-w / 2} y1={0}
          x2={w / 2} y2={0}
          stroke={ENG_COLORS.DOOR_ARC} strokeWidth={2} strokeDasharray="4 2"
        />
        <polygon
          points={`${w / 2},0 ${w / 2 - 6},-4 ${w / 2 - 6},4`}
          fill={ENG_COLORS.DOOR_ARC}
        />
      </g>
    );
  }

  // 여닫이/현관문: 90° 아크
  const r = w;
  const endAngle = (Math.PI / 2) * dir;
  const largeArc = 0;
  const sweep = dir > 0 ? 1 : 0;

  return (
    <g transform={`translate(${cx},${cy}) rotate(${(angle * 180) / Math.PI})`}>
      {/* 힌지점 */}
      <circle cx={-w / 2} cy={0} r={2} fill={ENG_COLORS.DOOR_ARC} />
      {/* 잎선 */}
      <line
        x1={-w / 2} y1={0}
        x2={-w / 2 + r} y2={0}
        stroke={ENG_COLORS.DOOR_LEAF} strokeWidth={1.5}
      />
      {/* 90° 아크 */}
      <path
        d={`M ${-w / 2 + r} 0 A ${r} ${r} 0 ${largeArc} ${sweep} ${-w / 2 + Math.cos(endAngle) * r} ${Math.sin(endAngle) * r}`}
        fill="none"
        stroke={ENG_COLORS.DOOR_ARC} strokeWidth={1} strokeDasharray="3 2"
      />
    </g>
  );
}

function RoomFillSVG({ room, scale }: { room: DetectedRoom; scale: number }) {
  if (!room.polygon || room.polygon.length < 3) return null;
  const fillColor =
    ENG_COLORS.ROOM_FILLS[room.type || "UTILITY"] || ENG_COLORS.ROOM_FILLS.UTILITY;
  const center = polygonCentroid(room.polygon);

  return (
    <g>
      <polygon
        points={room.polygon.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
        fill={fillColor}
        stroke="none"
      />
      <text
        x={center.x * scale}
        y={center.y * scale - 6}
        textAnchor="middle"
        fill={ENG_COLORS.LABEL_NAME}
        fontSize={11}
        fontWeight={600}
      >
        {room.name || (room.type ? ROOM_TYPE_LABELS[room.type] : "")}
      </text>
      <text
        x={center.x * scale}
        y={center.y * scale + 8}
        textAnchor="middle"
        fill={ENG_COLORS.LABEL_AREA}
        fontSize={9}
      >
        {room.area.toFixed(1)}m²
      </text>
    </g>
  );
}

// ─── Main Component ─────────────────────────────────

interface WallDrawingCanvasProps {
  knownArea?: number;
  onComplete?: (floorPlan: ParsedFloorPlan) => void;
  className?: string;
}

export default function WallDrawingCanvas({
  knownArea,
  onComplete,
  className = "",
}: WallDrawingCanvasProps) {
  const [state, dispatch] = useReducer(drawingReducer, undefined, createInitialState);
  const { current: ds } = state;
  const [tool, setTool] = useState<DrawingTool>("wall");
  const [drawingStart, setDrawingStart] = useState<DrawingPoint | null>(null);
  const [previewEnd, setPreviewEnd] = useState<DrawingPoint | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [showOpeningPlacer, setShowOpeningPlacer] = useState<{
    wallId: string;
    position: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [showRoomLabeler, setShowRoomLabeler] = useState<{
    roomId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wallIdCounter = useRef(0);
  const openingIdCounter = useRef(0);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const roomDetectTimer = useRef<ReturnType<typeof setTimeout>>();

  // 방 자동 감지 (벽 변경 시 디바운스)
  useEffect(() => {
    if (roomDetectTimer.current) clearTimeout(roomDetectTimer.current);
    roomDetectTimer.current = setTimeout(() => {
      if (ds.walls.length >= 3) {
        const rooms = detectRooms(ds.walls);
        dispatch({ type: "SET_ROOMS", rooms });
      } else {
        dispatch({ type: "SET_ROOMS", rooms: [] });
      }
    }, 300);
    return () => {
      if (roomDetectTimer.current) clearTimeout(roomDetectTimer.current);
    };
  }, [ds.walls]);

  // 마우스/터치 → 미터 좌표 변환
  const getMetersFromEvent = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): DrawingPoint => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return screenToMeters(sx, sy, ds.scale, ds.panOffset);
    },
    [ds.scale, ds.panOffset]
  );

  // 벽 히트 테스트
  const findWallAtPoint = useCallback(
    (point: DrawingPoint): DrawnWall | null => {
      let closest: DrawnWall | null = null;
      let minDist = WALL_HIT_THRESHOLD;
      for (const wall of ds.walls) {
        const dist = pointToSegmentDistance(point, wall.start, wall.end);
        if (dist < minDist) {
          minDist = dist;
          closest = wall;
        }
      }
      return closest;
    },
    [ds.walls]
  );

  // 방 히트 테스트 (점이 폴리곤 안에 있는지)
  const findRoomAtPoint = useCallback(
    (point: DrawingPoint): DetectedRoom | null => {
      for (const room of ds.rooms) {
        if (room.polygon.length < 3) continue;
        if (isPointInPolygon(point, room.polygon)) return room;
      }
      return null;
    },
    [ds.rooms]
  );

  // ─── Pointer Events ──────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // 두 번째 터치 = 팬 모드
      if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }

      const meterPoint = getMetersFromEvent(e);

      if (tool === "wall") {
        const snapped = snapPoint(meterPoint, ds.walls, ds.snapEnabled, ds.gridEnabled);
        setDrawingStart(snapped);
        setPreviewEnd(snapped);
      } else if (tool === "opening") {
        const wall = findWallAtPoint(meterPoint);
        if (wall) {
          const pos = getPositionOnSegment(meterPoint, wall.start, wall.end);
          const svg = svgRef.current;
          if (svg) {
            const rect = svg.getBoundingClientRect();
            setShowOpeningPlacer({
              wallId: wall.id,
              position: pos,
              screenX: e.clientX - rect.left,
              screenY: e.clientY - rect.top,
            });
          }
        }
      } else if (tool === "label") {
        const room = findRoomAtPoint(meterPoint);
        if (room) {
          const svg = svgRef.current;
          if (svg) {
            const rect = svg.getBoundingClientRect();
            setShowRoomLabeler({
              roomId: room.id,
              screenX: e.clientX - rect.left,
              screenY: e.clientY - rect.top,
            });
          }
        }
      } else if (tool === "eraser") {
        const wall = findWallAtPoint(meterPoint);
        if (wall) {
          dispatch({ type: "REMOVE_WALL", wallId: wall.id });
        }
      } else if (tool === "select") {
        // 팬 시작
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
      }
    },
    [tool, ds.walls, ds.snapEnabled, ds.gridEnabled, ds.rooms, getMetersFromEvent, findWallAtPoint, findRoomAtPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        panStart.current = { x: e.clientX, y: e.clientY };
        dispatch({
          type: "SET_PAN",
          offset: {
            x: ds.panOffset.x + dx,
            y: ds.panOffset.y + dy,
          },
        });
        return;
      }

      if (tool === "wall" && drawingStart) {
        const meterPoint = getMetersFromEvent(e);
        const straightened = straightenLine(drawingStart, meterPoint);
        const snapped = snapPoint(straightened, ds.walls, ds.snapEnabled, ds.gridEnabled);
        setPreviewEnd(snapped);
      }

      // 벽 호버 하이라이트
      if (tool === "opening" || tool === "eraser") {
        const meterPoint = getMetersFromEvent(e);
        const wall = findWallAtPoint(meterPoint);
        setHoveredWallId(wall?.id || null);
      }
    },
    [tool, drawingStart, ds.walls, ds.panOffset, ds.snapEnabled, ds.gridEnabled, getMetersFromEvent, findWallAtPoint]
  );

  const handlePointerUp = useCallback(
    () => {
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }

      if (tool === "wall" && drawingStart && previewEnd) {
        const len = Math.sqrt(
          (previewEnd.x - drawingStart.x) ** 2 +
            (previewEnd.y - drawingStart.y) ** 2
        );
        if (len >= MIN_WALL_LENGTH) {
          const newWall: DrawnWall = {
            id: `dw-${wallIdCounter.current++}`,
            start: { ...drawingStart },
            end: { ...previewEnd },
            thickness: DEFAULT_WALL_THICKNESS,
            isExterior: false,
            openings: [],
          };
          dispatch({ type: "ADD_WALL", wall: newWall });
        }
        setDrawingStart(null);
        setPreviewEnd(null);
      }
    },
    [tool, drawingStart, previewEnd]
  );

  // 마우스 휠 줌
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(10, Math.min(200, ds.scale * factor));

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      dispatch({
        type: "SET_PAN",
        offset: {
          x: cx - (cx - ds.panOffset.x) * (newScale / ds.scale),
          y: cy - (cy - ds.panOffset.y) * (newScale / ds.scale),
        },
      });
      dispatch({ type: "SET_SCALE", scale: newScale });
    },
    [ds.scale, ds.panOffset]
  );

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if (e.key === "Escape") {
        setDrawingStart(null);
        setPreviewEnd(null);
        setShowOpeningPlacer(null);
        setShowRoomLabeler(null);
      } else if (e.key === "1") setTool("wall");
      else if (e.key === "2") setTool("select");
      else if (e.key === "3") setTool("opening");
      else if (e.key === "4") setTool("eraser");
      else if (e.key === "5") setTool("label");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 개구부 추가 핸들러
  const handleAddOpening = useCallback(
    (type: OpeningType) => {
      if (!showOpeningPlacer) return;
      const opening: WallOpening = {
        id: `op-${openingIdCounter.current++}`,
        type,
        positionOnWall: showOpeningPlacer.position,
        width: OPENING_DEFAULTS[type].width,
        swingDirection: "left",
      };
      dispatch({
        type: "ADD_OPENING",
        wallId: showOpeningPlacer.wallId,
        opening,
      });
      setShowOpeningPlacer(null);
    },
    [showOpeningPlacer]
  );

  // 방 라벨링 핸들러
  const handleLabelRoom = useCallback(
    (roomType: RoomType) => {
      if (!showRoomLabeler) return;
      dispatch({
        type: "LABEL_ROOM",
        roomId: showRoomLabeler.roomId,
        roomType,
        name: ROOM_TYPE_LABELS[roomType],
      });
      setShowRoomLabeler(null);
    },
    [showRoomLabeler]
  );

  // 완료 핸들러
  const handleComplete = useCallback(() => {
    const floorPlan = exportToFloorPlan(ds, knownArea);
    onComplete?.(floorPlan);
  }, [ds, knownArea, onComplete]);

  // SVG 사이즈
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}
      style={{ minHeight: 400 }}
    >
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={svgSize.width}
        height={svgSize.height}
        className="touch-none select-none"
        style={{ cursor: tool === "wall" ? "crosshair" : tool === "eraser" ? "not-allowed" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* 그리드 */}
        {ds.gridEnabled && (
          <>
            <GridPattern scale={ds.scale} gridSize={GRID_SIZE} />
            <rect
              x={0} y={0}
              width={svgSize.width} height={svgSize.height}
              fill="url(#wall-drawing-grid)"
            />
          </>
        )}

        {/* 변환 그룹 (팬 오프셋) */}
        <g transform={`translate(${ds.panOffset.x},${ds.panOffset.y})`}>
          {/* 방 채우기 */}
          {ds.rooms.map((room) => (
            <RoomFillSVG key={room.id} room={room} scale={ds.scale} />
          ))}

          {/* 벽 */}
          {ds.walls.map((wall) => (
            <g key={wall.id}>
              <WallSVG
                wall={wall}
                scale={ds.scale}
              />
              {/* 호버 하이라이트 */}
              {hoveredWallId === wall.id && (
                <line
                  x1={wall.start.x * ds.scale}
                  y1={wall.start.y * ds.scale}
                  x2={wall.end.x * ds.scale}
                  y2={wall.end.y * ds.scale}
                  stroke={ENG_COLORS.SELECTED_STROKE}
                  strokeWidth={4}
                  opacity={0.4}
                />
              )}
              {/* 개구부 */}
              {wall.openings.map((op) => (
                <OpeningSVG
                  key={op.id}
                  wall={wall}
                  opening={op}
                  scale={ds.scale}
                />
              ))}
            </g>
          ))}

          {/* 프리뷰 선 */}
          {drawingStart && previewEnd && (
            <line
              x1={drawingStart.x * ds.scale}
              y1={drawingStart.y * ds.scale}
              x2={previewEnd.x * ds.scale}
              y2={previewEnd.y * ds.scale}
              stroke={ENG_COLORS.WALL_INTERIOR}
              strokeWidth={3}
              strokeDasharray="6 4"
              opacity={0.6}
            />
          )}

          {/* 스냅 인디케이터 */}
          {ds.walls.map((wall) =>
            [wall.start, wall.end].map((ep, i) => (
              <circle
                key={`snap-${wall.id}-${i}`}
                cx={ep.x * ds.scale}
                cy={ep.y * ds.scale}
                r={3}
                fill={ENG_COLORS.SELECTED_STROKE}
                opacity={0.5}
              />
            ))
          )}
        </g>
      </svg>

      {/* ─── 하단 툴바 ─── */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* 도구 */}
          <div className="flex gap-1">
            {(
              [
                ["wall", "벽"],
                ["select", "이동"],
                ["opening", "개구부"],
                ["eraser", "삭제"],
                ["label", "라벨"],
              ] as [DrawingTool, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  tool === t
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Undo/Redo */}
          <div className="flex gap-1">
            <button
              onClick={() => dispatch({ type: "UNDO" })}
              disabled={state.undoStack.length === 0}
              className="px-2 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
            >
              ↩
            </button>
            <button
              onClick={() => dispatch({ type: "REDO" })}
              disabled={state.redoStack.length === 0}
              className="px-2 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
            >
              ↪
            </button>
          </div>

          {/* 토글 */}
          <div className="flex gap-1">
            <button
              onClick={() => dispatch({ type: "TOGGLE_GRID" })}
              className={`px-2 py-1.5 rounded-md ${
                ds.gridEnabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              그리드
            </button>
            <button
              onClick={() => dispatch({ type: "TOGGLE_SNAP" })}
              className={`px-2 py-1.5 rounded-md ${
                ds.snapEnabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              스냅
            </button>
          </div>

          {/* 정보 + 완료 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              벽 {ds.walls.length} | 방 {ds.rooms.length} |{" "}
              {ds.rooms.reduce((s, r) => s + r.area, 0).toFixed(1)}m²
            </span>
            <button
              onClick={handleComplete}
              disabled={ds.walls.length < 3}
              className="px-4 py-1.5 rounded-md bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-30"
            >
              완료 →
            </button>
          </div>
        </div>
      </div>

      {/* ─── 개구부 팝오버 ─── */}
      {showOpeningPlacer && (
        <div
          className="absolute bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50"
          style={{
            left: Math.min(showOpeningPlacer.screenX, svgSize.width - 260),
            top: Math.max(10, showOpeningPlacer.screenY - 160),
          }}
        >
          <div className="text-xs font-semibold text-gray-700 mb-2">개구부 추가</div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {(
              [
                ["swing", "여닫이", "900"],
                ["sliding", "미닫이", "1800"],
                ["entrance", "현관문", "950"],
              ] as [OpeningType, string, string][]
            ).map(([type, label, mm]) => (
              <button
                key={type}
                onClick={() => handleAddOpening(type)}
                className="px-2 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-xs text-center border border-orange-200"
              >
                <div className="font-medium text-orange-800">{label}</div>
                <div className="text-orange-500">{mm}mm</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {(
              [
                ["window", "창문", "1500"],
                ["large_window", "거실창", "2400"],
              ] as [OpeningType, string, string][]
            ).map(([type, label, mm]) => (
              <button
                key={type}
                onClick={() => handleAddOpening(type)}
                className="px-2 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs text-center border border-blue-200"
              >
                <div className="font-medium text-blue-800">{label}</div>
                <div className="text-blue-500">{mm}mm</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowOpeningPlacer(null)}
            className="w-full text-xs text-gray-400 hover:text-gray-600"
          >
            취소
          </button>
        </div>
      )}

      {/* ─── 방 라벨링 팝오버 ─── */}
      {showRoomLabeler && (
        <div
          className="absolute bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50"
          style={{
            left: Math.min(showRoomLabeler.screenX, svgSize.width - 200),
            top: Math.max(10, showRoomLabeler.screenY - 180),
          }}
        >
          <div className="text-xs font-semibold text-gray-700 mb-2">공간 유형</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]
            ).map(([type, label]) => (
              <button
                key={type}
                onClick={() => handleLabelRoom(type)}
                className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 border border-gray-200"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowRoomLabeler(null)}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            취소
          </button>
        </div>
      )}

      {/* ─── 상단 힌트 ─── */}
      <div className="absolute top-3 left-3 text-xs text-gray-400">
        {tool === "wall" && "클릭 → 드래그 → 놓기로 벽을 그리세요 (자동 직선 보정)"}
        {tool === "opening" && "벽을 클릭하여 문/창문을 배치하세요"}
        {tool === "eraser" && "벽을 클릭하여 삭제하세요"}
        {tool === "label" && "방 안을 클릭하여 공간 유형을 지정하세요"}
        {tool === "select" && "드래그하여 캔버스를 이동하세요"}
      </div>
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────

function isPointInPolygon(point: DrawingPoint, polygon: DrawingPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
