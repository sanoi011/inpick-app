"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  ROOM_FLOOR_CATEGORY,
  hexToRgb,
  type RoomTypeKey,
  type RoomColorMap,
} from "@/lib/constants/room-segmentation";
import { getProductById } from "@/lib/data/material-catalog-v2";

interface FloorPlanCanvasProps {
  imageUrl: string;
  maskUrl: string;
  roomColorMap: RoomColorMap;
  /** categoryCode → productId */
  selectedProducts: Record<string, string>;
  onRoomClick?: (roomType: RoomTypeKey, label: string) => void;
  className?: string;
  /** 0~1, default 0.35 */
  overlayOpacity?: number;
}

/** Euclidean distance squared between two RGB values */
function colorDistSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/** Build per-room pixel index cache from mask imageData */
function buildPixelCache(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  rooms: RoomColorMap["rooms"]
): Map<RoomTypeKey, Uint32Array> {
  const colorTargets = rooms.map((room) => {
    const [r, g, b] = hexToRgb(room.color);
    return { type: room.type, r, g, b };
  });

  const buckets = new Map<RoomTypeKey, number[]>();
  for (const room of rooms) {
    buckets.set(room.type, []);
  }

  const total = width * height;
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const pr = maskData[off];
    const pg = maskData[off + 1];
    const pb = maskData[off + 2];

    // Skip black (walls) and white (background)
    if (pr < 20 && pg < 20 && pb < 20) continue;
    if (pr > 235 && pg > 235 && pb > 235) continue;

    let bestDist = Infinity;
    let bestType: RoomTypeKey | null = null;
    for (const c of colorTargets) {
      const d = colorDistSq(pr, pg, pb, c.r, c.g, c.b);
      if (d < bestDist) {
        bestDist = d;
        bestType = c.type;
      }
    }

    // threshold: ~50 per channel → 50²×3 = 7500
    if (bestType && bestDist < 7500) {
      buckets.get(bestType)!.push(i);
    }
  }

  const cache = new Map<RoomTypeKey, Uint32Array>();
  Array.from(buckets.entries()).forEach(([type, indices]) => {
    if (indices.length > 0) {
      cache.set(type, new Uint32Array(indices));
    }
  });
  return cache;
}

export default function FloorPlanCanvas({
  imageUrl,
  maskUrl,
  roomColorMap,
  selectedProducts,
  onRoomClick,
  className = "",
  overlayOpacity = 0.35,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Image data stored off-screen
  const baseImageDataRef = useRef<ImageData | null>(null);
  const maskRawRef = useRef<Uint8ClampedArray | null>(null);
  const pixelCacheRef = useRef<Map<RoomTypeKey, Uint32Array>>(new Map());
  const imgSizeRef = useRef({ w: 0, h: 0 });

  const [loaded, setLoaded] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<RoomTypeKey | null>(null);

  // Load base image + mask, build pixel cache
  useEffect(() => {
    if (!imageUrl || !maskUrl || !roomColorMap?.rooms?.length) return;

    let cancelled = false;

    const loadImages = async () => {
      try {
        const [baseImg, maskImg] = await Promise.all([
          loadImage(imageUrl),
          loadImage(maskUrl),
        ]);
        if (cancelled) return;

        const w = baseImg.width;
        const h = baseImg.height;
        imgSizeRef.current = { w, h };

        // Extract base image data
        const offscreen = document.createElement("canvas");
        offscreen.width = w;
        offscreen.height = h;
        const octx = offscreen.getContext("2d")!;
        octx.drawImage(baseImg, 0, 0);
        baseImageDataRef.current = octx.getImageData(0, 0, w, h);

        // Extract mask data (resize to match base if needed)
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mctx = maskCanvas.getContext("2d")!;
        // Use nearest-neighbor for mask (no anti-aliasing)
        mctx.imageSmoothingEnabled = false;
        mctx.drawImage(maskImg, 0, 0, w, h);
        const maskImageData = mctx.getImageData(0, 0, w, h);
        maskRawRef.current = maskImageData.data;

        // Build pixel cache
        pixelCacheRef.current = buildPixelCache(
          maskImageData.data,
          w,
          h,
          roomColorMap.rooms
        );

        setLoaded(true);
      } catch {
        // Image load failed silently
      }
    };

    loadImages();
    return () => { cancelled = true; };
  }, [imageUrl, maskUrl, roomColorMap]);

  // Helper: get selected color for a room type
  const getSelectedColor = useCallback(
    (roomType: RoomTypeKey): string | null => {
      const category = ROOM_FLOOR_CATEGORY[roomType];
      if (!category) return null;
      const productId = selectedProducts[category];
      if (!productId) return null;
      const found = getProductById(productId);
      return found?.product.colorHex || null;
    },
    [selectedProducts]
  );

  // Render overlay whenever selections or hover change
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    const baseData = baseImageDataRef.current;
    if (!canvas || !baseData) return;

    const { w, h } = imgSizeRef.current;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;

    // Copy base image data
    const output = new ImageData(
      new Uint8ClampedArray(baseData.data),
      w,
      h
    );
    const pixels = output.data;

    // For each room, check if there's a selected product with a colorHex
    for (const [roomType, indices] of Array.from(pixelCacheRef.current.entries())) {
      const category = ROOM_FLOOR_CATEGORY[roomType];
      if (!category) continue;

      const productId = selectedProducts[category];
      if (!productId) continue;

      const found = getProductById(productId);
      if (!found?.product.colorHex) continue;

      const [cr, cg, cb] = hexToRgb(found.product.colorHex);
      const isHovered = hoveredRoom === roomType;
      const alpha = isHovered ? Math.min(overlayOpacity + 0.15, 0.7) : overlayOpacity;
      const invAlpha = 1 - alpha;

      for (let k = 0; k < indices.length; k++) {
        const off = indices[k] * 4;
        pixels[off] = Math.round(pixels[off] * invAlpha + cr * alpha);
        pixels[off + 1] = Math.round(pixels[off + 1] * invAlpha + cg * alpha);
        pixels[off + 2] = Math.round(pixels[off + 2] * invAlpha + cb * alpha);
      }
    }

    // Hover highlight for rooms WITHOUT a selection
    if (hoveredRoom && !getSelectedColor(hoveredRoom)) {
      const indices = pixelCacheRef.current.get(hoveredRoom);
      if (indices) {
        const hoverAlpha = 0.15;
        const invH = 1 - hoverAlpha;
        for (let k = 0; k < indices.length; k++) {
          const off = indices[k] * 4;
          pixels[off] = Math.round(pixels[off] * invH + 100 * hoverAlpha);
          pixels[off + 1] = Math.round(pixels[off + 1] * invH + 150 * hoverAlpha);
          pixels[off + 2] = Math.round(pixels[off + 2] * invH + 255 * hoverAlpha);
        }
      }
    }

    ctx.putImageData(output, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, selectedProducts, hoveredRoom, overlayOpacity, getSelectedColor]);

  // Identify room under a canvas coordinate
  const getRoomAtPoint = useCallback(
    (canvasX: number, canvasY: number): RoomTypeKey | null => {
      const maskData = maskRawRef.current;
      if (!maskData) return null;

      const { w } = imgSizeRef.current;
      const idx = (Math.round(canvasY) * w + Math.round(canvasX)) * 4;
      if (idx < 0 || idx >= maskData.length) return null;

      const pr = maskData[idx];
      const pg = maskData[idx + 1];
      const pb = maskData[idx + 2];

      // Skip walls/background
      if (pr < 20 && pg < 20 && pb < 20) return null;
      if (pr > 235 && pg > 235 && pb > 235) return null;

      // Find closest room color
      let bestDist = Infinity;
      let bestType: RoomTypeKey | null = null;
      for (const room of roomColorMap.rooms) {
        const [r, g, b] = hexToRgb(room.color);
        const d = colorDistSq(pr, pg, pb, r, g, b);
        if (d < bestDist) {
          bestDist = d;
          bestType = room.type;
        }
      }

      return bestType && bestDist < 7500 ? bestType : null;
    },
    [roomColorMap]
  );

  // Convert DOM mouse position → canvas pixel coordinates
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onRoomClick) return;
      const pt = toCanvasCoords(e.clientX, e.clientY);
      if (!pt) return;
      const roomType = getRoomAtPoint(pt.x, pt.y);
      if (!roomType) return;
      const room = roomColorMap.rooms.find((r) => r.type === roomType);
      if (room) onRoomClick(roomType, room.label);
    },
    [onRoomClick, toCanvasCoords, getRoomAtPoint, roomColorMap]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pt = toCanvasCoords(e.clientX, e.clientY);
      if (!pt) { setHoveredRoom(null); return; }
      const roomType = getRoomAtPoint(pt.x, pt.y);
      setHoveredRoom(roomType);
    },
    [toCanvasCoords, getRoomAtPoint]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredRoom(null);
  }, []);

  // Room legend
  const legendItems = roomColorMap.rooms
    .filter((r) => ROOM_FLOOR_CATEGORY[r.type] !== null)
    .map((r) => {
      const cat = ROOM_FLOOR_CATEGORY[r.type];
      const productId = cat ? selectedProducts[cat] : null;
      const found = productId ? getProductById(productId) : null;
      return {
        type: r.type,
        label: r.label,
        color: r.color,
        selectedProduct: found?.product || null,
      };
    });

  if (!loaded) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-xl ${className}`}>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-400">도면 마스크 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-xl cursor-pointer"
        style={{ imageRendering: "auto" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Hover tooltip */}
      {hoveredRoom && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
          {roomColorMap.rooms.find((r) => r.type === hoveredRoom)?.label || hoveredRoom}
          {getSelectedColor(hoveredRoom) && " ✓"}
        </div>
      )}

      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {legendItems.map((item) => (
            <button
              key={item.type}
              onClick={() => onRoomClick?.(item.type, item.label)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                item.selectedProduct
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: item.selectedProduct?.colorHex || item.color,
                }}
              />
              {item.label}
              {item.selectedProduct && " ✓"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Load an image as HTMLImageElement with CORS */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
