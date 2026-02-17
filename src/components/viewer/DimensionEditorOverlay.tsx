"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Trash2, Plus, Check, X, GripVertical } from "lucide-react";

// ─── Types ───────────────────────────────────────────

export interface EditableDimension {
  id: string;
  /** Normalized 0-1 coordinates relative to image */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Value in mm */
  valueMm: number;
  /** Room name this dimension belongs to */
  roomName: string;
  /** "width" or "height" */
  direction: "width" | "height";
}

export interface RoomDimSummary {
  name: string;
  widthMm: number | null;
  heightMm: number | null;
  areaSqm: number | null;
}

interface DimensionEditorOverlayProps {
  /** Container must have position:relative */
  containerRef: React.RefObject<HTMLDivElement | null>;
  dimensions: EditableDimension[];
  onChange: (dims: EditableDimension[]) => void;
  editable: boolean;
}

// ─── Helpers ─────────────────────────────────────────

function generateId() {
  return `dim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Calculate room summaries from dimensions */
export function calcRoomSummaries(dims: EditableDimension[]): RoomDimSummary[] {
  const roomMap = new Map<string, { widths: number[]; heights: number[] }>();

  for (const d of dims) {
    if (!d.roomName) continue;
    if (!roomMap.has(d.roomName)) {
      roomMap.set(d.roomName, { widths: [], heights: [] });
    }
    const entry = roomMap.get(d.roomName)!;
    if (d.direction === "width") entry.widths.push(d.valueMm);
    else entry.heights.push(d.valueMm);
  }

  const summaries: RoomDimSummary[] = [];
  Array.from(roomMap.entries()).forEach(([name, { widths, heights }]) => {
    const w = widths.length > 0 ? Math.max(...widths) : null;
    const h = heights.length > 0 ? Math.max(...heights) : null;
    const area = w && h ? (w / 1000) * (h / 1000) : null;
    summaries.push({
      name,
      widthMm: w,
      heightMm: h,
      areaSqm: area ? Math.round(area * 100) / 100 : null,
    });
  });

  return summaries.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

// ─── Preset room names ──────────────────────────────
const ROOM_PRESETS = [
  "거실", "안방", "침실1", "침실2", "침실3",
  "주방", "욕실1", "욕실2", "현관", "드레스룸",
  "다용도실", "복도",
];

// ─── Component ───────────────────────────────────────

export default function DimensionEditorOverlay({
  containerRef,
  dimensions,
  onChange,
  editable,
}: DimensionEditorOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<"select" | "add">("select");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editField, setEditField] = useState<"value" | "room">("value");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ dimId: string; handle: "start" | "end" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track actual image rendered area within container
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Measure the actual rendered image area (object-contain leaves gaps)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measureImage() {
      const container = containerRef.current;
      if (!container) return;
      const img = container.querySelector("img");
      if (!img || !img.naturalWidth || !img.naturalHeight) return;

      const containerRect = container.getBoundingClientRect();
      const cw = containerRect.width;
      const ch = containerRect.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // Calculate object-contain fit
      const scale = Math.min(cw / iw, ch / ih);
      const renderedW = iw * scale;
      const renderedH = ih * scale;
      const left = (cw - renderedW) / 2;
      const top = (ch - renderedH) / 2;

      setImgRect({ left, top, width: renderedW, height: renderedH });
    }

    // Measure on load and resize
    const img = container.querySelector("img");
    if (img) {
      if (img.complete) {
        measureImage();
      } else {
        img.addEventListener("load", measureImage);
      }
    }

    const ro = new ResizeObserver(measureImage);
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (img) img.removeEventListener("load", measureImage);
    };
  }, [containerRef]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, editField]);

  // Get normalized 0-1 coordinates relative to the IMAGE (not container)
  const getNormCoords = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container || !imgRect) return null;
    const containerRect = container.getBoundingClientRect();
    // Mouse position relative to container
    const cx = e.clientX - containerRect.left;
    const cy = e.clientY - containerRect.top;
    // Convert to image-relative normalized coords
    const x = (cx - imgRect.left) / imgRect.width;
    const y = (cy - imgRect.top) / imgRect.height;
    // Clamp to 0-1
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }, [containerRef, imgRect]);

  // ─── Drawing new dimension ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();

    if (tool === "add") {
      const pos = getNormCoords(e);
      if (!pos) return;

      if (!drawStart) {
        setDrawStart(pos);
      } else {
        // Complete the dimension line
        const dx = Math.abs(pos.x - drawStart.x);
        const dy = Math.abs(pos.y - drawStart.y);
        const direction: "width" | "height" = dx >= dy ? "width" : "height";

        // Snap to axis if close
        const snapped = { ...pos };
        if (direction === "width") snapped.y = drawStart.y;
        else snapped.x = drawStart.x;

        const newDim: EditableDimension = {
          id: generateId(),
          x1: drawStart.x,
          y1: drawStart.y,
          x2: snapped.x,
          y2: snapped.y,
          valueMm: 3000, // Default 3m
          roomName: "",
          direction,
        };

        onChange([...dimensions, newDim]);
        setDrawStart(null);
        setMousePos(null);
        setEditingId(newDim.id);
        setEditField("value");
        setEditValue("3000");
        setTool("select");
      }
    } else if (tool === "select") {
      // Check if clicking on a handle
      const pos = getNormCoords(e);
      if (!pos) return;

      for (const dim of dimensions) {
        const dStart = Math.hypot(pos.x - dim.x1, pos.y - dim.y1);
        const dEnd = Math.hypot(pos.x - dim.x2, pos.y - dim.y2);
        if (dStart < 0.02) {
          setDragging({ dimId: dim.id, handle: "start" });
          e.preventDefault();
          return;
        }
        if (dEnd < 0.02) {
          setDragging({ dimId: dim.id, handle: "end" });
          e.preventDefault();
          return;
        }
      }
    }
  }, [editable, tool, drawStart, dimensions, onChange, getNormCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getNormCoords(e);
    if (!pos) return;

    if (tool === "add" && drawStart) {
      setMousePos(pos);
    }

    if (dragging) {
      const updated = dimensions.map((d) => {
        if (d.id !== dragging.dimId) return d;
        if (dragging.handle === "start") return { ...d, x1: pos.x, y1: pos.y };
        return { ...d, x2: pos.x, y2: pos.y };
      });
      onChange(updated);
    }
  }, [tool, drawStart, dragging, dimensions, onChange, getNormCoords]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ─── Edit dimension value ───
  const startEdit = useCallback((dimId: string, field: "value" | "room") => {
    if (!editable) return;
    const dim = dimensions.find((d) => d.id === dimId);
    if (!dim) return;
    setEditingId(dimId);
    setEditField(field);
    setEditValue(field === "value" ? String(dim.valueMm) : dim.roomName);
    setSelectedId(dimId);
  }, [editable, dimensions]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const updated = dimensions.map((d) => {
      if (d.id !== editingId) return d;
      if (editField === "value") {
        const val = parseInt(editValue, 10);
        return { ...d, valueMm: isNaN(val) || val <= 0 ? d.valueMm : val };
      }
      return { ...d, roomName: editValue.trim() };
    });
    onChange(updated);
    setEditingId(null);
  }, [editingId, editField, editValue, dimensions, onChange]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const deleteDim = useCallback((id: string) => {
    onChange(dimensions.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [dimensions, onChange, selectedId, editingId]);

  // ─── Render ───
  if (!editable && dimensions.length === 0) return null;
  if (!imgRect) return null; // Wait for image measurement

  const roomSummaries = calcRoomSummaries(dimensions);
  const totalArea = roomSummaries.reduce((sum, r) => sum + (r.areaSqm || 0), 0);

  // Convert normalized 0-1 to pixel coords within the SVG overlay
  const toPixelX = (nx: number) => imgRect.left + nx * imgRect.width;
  const toPixelY = (ny: number) => imgRect.top + ny * imgRect.height;

  // Get container dimensions for SVG viewBox
  const container = containerRef.current;
  const containerW = container?.clientWidth || 800;
  const containerH = container?.clientHeight || 600;

  return (
    <>
      {/* SVG Overlay - covers entire container but coordinates account for image position */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: editable ? "auto" : "none", zIndex: 10 }}
        viewBox={`0 0 ${containerW} ${containerH}`}
        preserveAspectRatio="none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dimension lines */}
        {dimensions.map((dim) => {
          const isSelected = dim.id === selectedId;
          const isEditing = dim.id === editingId;

          const px1 = toPixelX(dim.x1);
          const py1 = toPixelY(dim.y1);
          const px2 = toPixelX(dim.x2);
          const py2 = toPixelY(dim.y2);
          const mx = (px1 + px2) / 2;
          const my = (py1 + py2) / 2;

          // Tick marks (perpendicular)
          const dx = px2 - px1;
          const dy = py2 - py1;
          const len = Math.hypot(dx, dy);
          const tickLen = 8;
          const nx = len > 0 ? (-dy / len) * tickLen : 0;
          const ny = len > 0 ? (dx / len) * tickLen : 0;

          return (
            <g key={dim.id} onClick={(e) => { e.stopPropagation(); setSelectedId(dim.id); }}>
              {/* Main line */}
              <line
                x1={px1} y1={py1} x2={px2} y2={py2}
                stroke={isSelected ? "#2563eb" : "#dc2626"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              {/* Start tick */}
              <line
                x1={px1 - nx} y1={py1 - ny}
                x2={px1 + nx} y2={py1 + ny}
                stroke={isSelected ? "#2563eb" : "#dc2626"}
                strokeWidth={1.5}
              />
              {/* End tick */}
              <line
                x1={px2 - nx} y1={py2 - ny}
                x2={px2 + nx} y2={py2 + ny}
                stroke={isSelected ? "#2563eb" : "#dc2626"}
                strokeWidth={1.5}
              />

              {/* Value label */}
              {!isEditing && (
                <g
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(dim.id, "value"); }}
                  style={{ cursor: editable ? "pointer" : "default" }}
                >
                  <rect
                    x={mx - 30} y={my - 10}
                    width={60} height={18}
                    fill="white" fillOpacity={0.9}
                    rx={3}
                    stroke={isSelected ? "#2563eb" : "#999"}
                    strokeWidth={0.8}
                  />
                  <text
                    x={mx} y={my + 1}
                    textAnchor="middle" dominantBaseline="central"
                    fill={isSelected ? "#2563eb" : "#333"}
                    fontSize={11}
                    fontWeight={600}
                    fontFamily="sans-serif"
                  >
                    {dim.valueMm.toLocaleString()}
                  </text>
                </g>
              )}

              {/* Room name label */}
              {dim.roomName && !isEditing && (
                <g onDoubleClick={(e) => { e.stopPropagation(); startEdit(dim.id, "room"); }}>
                  <text
                    x={mx} y={my + 16}
                    textAnchor="middle" dominantBaseline="central"
                    fill="#6b7280"
                    fontSize={9}
                    fontFamily="sans-serif"
                  >
                    {dim.roomName} {dim.direction === "width" ? "가로" : "세로"}
                  </text>
                </g>
              )}

              {/* Drag handles */}
              {editable && (
                <>
                  <circle
                    cx={px1} cy={py1} r={6}
                    fill={isSelected ? "#2563eb" : "#ef4444"}
                    fillOpacity={0.6}
                    stroke="white" strokeWidth={1.5}
                    style={{ cursor: "move" }}
                  />
                  <circle
                    cx={px2} cy={py2} r={6}
                    fill={isSelected ? "#2563eb" : "#ef4444"}
                    fillOpacity={0.6}
                    stroke="white" strokeWidth={1.5}
                    style={{ cursor: "move" }}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* Drawing preview */}
        {tool === "add" && drawStart && mousePos && (
          <>
            <line
              x1={toPixelX(drawStart.x)} y1={toPixelY(drawStart.y)}
              x2={toPixelX(mousePos.x)} y2={toPixelY(mousePos.y)}
              stroke="#3b82f6" strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <circle cx={toPixelX(drawStart.x)} cy={toPixelY(drawStart.y)} r={5}
              fill="#3b82f6" fillOpacity={0.5} />
            <circle cx={toPixelX(mousePos.x)} cy={toPixelY(mousePos.y)} r={5}
              fill="#3b82f6" fillOpacity={0.5} />
          </>
        )}
      </svg>

      {/* Editing input overlay */}
      {editingId && editable && (() => {
        const dim = dimensions.find((d) => d.id === editingId);
        if (!dim || !containerRef.current) return null;
        const mx = toPixelX((dim.x1 + dim.x2) / 2);
        const my = toPixelY((dim.y1 + dim.y2) / 2);

        return (
          <div
            className="absolute z-20 flex items-center gap-1"
            style={{
              left: `${mx}px`,
              top: `${my - 16}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <input
              ref={inputRef}
              type={editField === "value" ? "number" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="w-24 px-2 py-1 text-xs font-medium border border-blue-400 rounded shadow-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-center"
              placeholder={editField === "value" ? "mm" : "방 이름"}
            />
            <button onClick={commitEdit}
              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={cancelEdit}
              className="p-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })()}

      {/* Bottom panel: tools + room summaries */}
      {editable && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 max-h-[40%] overflow-y-auto">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700 mr-2">치수 편집</span>
            <button
              onClick={() => { setTool("select"); setDrawStart(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                tool === "select"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <GripVertical className="w-3 h-3 inline mr-0.5" />선택
            </button>
            <button
              onClick={() => { setTool("add"); setDrawStart(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                tool === "add"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Plus className="w-3 h-3 inline mr-0.5" />추가
            </button>
            {tool === "add" && (
              <span className="text-[10px] text-blue-600 font-medium">
                {drawStart ? "끝점을 클릭하세요" : "시작점을 클릭하세요"}
              </span>
            )}
            <div className="flex-1" />
            {totalArea > 0 && (
              <span className="text-xs font-bold text-blue-700">
                총 {totalArea.toFixed(1)}m²
              </span>
            )}
          </div>

          {/* Dimension list + room summaries */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Dimensions list */}
            <div className="flex-1 px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">치수선 목록</p>
              {dimensions.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">
                  &ldquo;추가&rdquo; 버튼을 클릭 후 도면 위 두 점을 클릭하여 치수선을 추가하세요
                </p>
              ) : (
                <div className="space-y-1">
                  {dimensions.map((dim) => (
                    <div
                      key={dim.id}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                        selectedId === dim.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedId(dim.id)}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        dim.direction === "width" ? "bg-red-400" : "bg-green-400"
                      }`} />
                      <span className="font-mono font-bold text-gray-900 min-w-[50px]">
                        {dim.valueMm.toLocaleString()}mm
                      </span>
                      {dim.roomName ? (
                        <span className="text-gray-500 truncate">
                          {dim.roomName} ({dim.direction === "width" ? "가로" : "세로"})
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(dim.id, "room"); }}
                          className="text-blue-500 hover:text-blue-700 text-[10px]"
                        >
                          방 지정
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(dim.id, "value"); }}
                        className="text-gray-400 hover:text-blue-600 text-[10px] px-1"
                        title="치수 수정"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteDim(dim.id); }}
                        className="text-gray-400 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Room summaries */}
            {roomSummaries.length > 0 && (
              <div className="flex-1 px-3 py-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">방별 면적</p>
                <div className="space-y-1">
                  {roomSummaries.map((room) => (
                    <div key={room.name} className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-gray-800 min-w-[48px]">{room.name}</span>
                      <span className="text-gray-400 font-mono">
                        {room.widthMm ? `${(room.widthMm / 1000).toFixed(1)}m` : "?"}
                        {" × "}
                        {room.heightMm ? `${(room.heightMm / 1000).toFixed(1)}m` : "?"}
                      </span>
                      {room.areaSqm && (
                        <span className="font-bold text-blue-700">
                          = {room.areaSqm}m²
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Room name quick-assign */}
                {selectedId && !dimensions.find((d) => d.id === selectedId)?.roomName && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 mb-1">빠른 방 지정:</p>
                    <div className="flex flex-wrap gap-1">
                      {ROOM_PRESETS.map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            const updated = dimensions.map((d) =>
                              d.id === selectedId ? { ...d, roomName: name } : d
                            );
                            onChange(updated);
                          }}
                          className="px-2 py-0.5 text-[10px] font-medium rounded-full border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
