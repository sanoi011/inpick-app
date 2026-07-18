import type { FloorplanAIResponse } from "@/lib/services/floorplan-ai-client";

export interface InferredRoom {
  name: string;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  xMm?: number;
  yMm?: number;
}

export interface InferredFloorplanStructure {
  rooms?: InferredRoom[];
  openings?: Array<{
    wall?: string;
    type?: string;
    widthMm?: number;
    heightMm?: number;
  }>;
  detectedAreaM2?: number;
  totalWidthMm?: number;
  totalDepthMm?: number;
  notes?: string;
}

/** Normalize either deployed floorplan inference contract into the workflow shape. */
export function floorplanAIToStructure(
  response: FloorplanAIResponse,
): InferredFloorplanStructure {
  if (response.format === "legacy") {
    const vector = response.data.vector_data;
    const rooms = vector.rooms.map((room) => {
      const xs = room.vertices.map((vertex) => vertex.x);
      const ys = room.vertices.map((vertex) => vertex.y);
      const minX = xs.length ? Math.min(...xs) : undefined;
      const minY = ys.length ? Math.min(...ys) : undefined;
      const maxX = xs.length ? Math.max(...xs) : undefined;
      const maxY = ys.length ? Math.max(...ys) : undefined;
      return {
        name: room.name || room.type || "공간",
        xMm: minX,
        yMm: minY,
        widthMm: minX != null && maxX != null ? maxX - minX : undefined,
        depthMm: minY != null && maxY != null ? maxY - minY : undefined,
      };
    });
    const openings = vector.symbols
      .filter((symbol) => /door|window|문|창/i.test(`${symbol.type} ${symbol.type_ko}`))
      .map((symbol) => ({
        wall: "detected",
        type: /window|창/i.test(`${symbol.type} ${symbol.type_ko}`) ? "window" : "door",
        widthMm: Math.max(0, symbol.bbox.x2 - symbol.bbox.x1) * vector.scale_factor,
      }));
    return {
      rooms,
      openings,
      detectedAreaM2: vector.rooms.reduce((sum, room) => sum + (room.area_m2 || 0), 0),
      totalWidthMm: vector.canvas.width * vector.scale_factor,
      totalDepthMm: vector.canvas.height * vector.scale_factor,
      notes: `InPick floorplan-ai · walls ${vector.walls.length} · symbols ${vector.symbols.length}`,
    };
  }

  const project = response.data.project;
  const mmPerPx = project.meta.mm_per_px || undefined;
  const rooms = project.rooms.map((room) => {
    // v4.7 does not expose a room polygon yet. Preserve area and center without
    // inventing an aspect ratio by using an explicitly provisional square extent.
    const sideMm = room.area_m2 > 0 ? Math.sqrt(room.area_m2) * 1_000 : undefined;
    return {
      name: room.name || room.type || "공간",
      xMm: mmPerPx ? room.center_px[0] * mmPerPx - (sideMm || 0) / 2 : undefined,
      yMm: mmPerPx ? room.center_px[1] * mmPerPx - (sideMm || 0) / 2 : undefined,
      widthMm: sideMm,
      depthMm: sideMm,
    };
  });
  const wallXs = project.walls.flatMap((wall) => [wall.x0_mm, wall.x1_mm]);
  const wallYs = project.walls.flatMap((wall) => [wall.y0_mm, wall.y1_mm]);
  return {
    rooms,
    openings: project.openings.map((opening) => ({
      wall: opening.id,
      type: opening.type,
      widthMm: opening.widthMm,
    })),
    detectedAreaM2: project.rooms.reduce((sum, room) => sum + (room.area_m2 || 0), 0),
    totalWidthMm: wallXs.length ? Math.max(...wallXs) - Math.min(...wallXs) : undefined,
    totalDepthMm: wallYs.length ? Math.max(...wallYs) - Math.min(...wallYs) : undefined,
    notes: `InPick floorplan-ai v4.7 · walls ${project.walls.length} · scale ${project.meta.scale_status}`,
  };
}
