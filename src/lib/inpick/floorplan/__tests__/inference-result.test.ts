import assert from "node:assert/strict";
import test from "node:test";

import { floorplanAIToStructure } from "../inference-result";
import type { FloorplanAIResponse } from "@/lib/services/floorplan-ai-client";

test("legacy inference preserves polygon extents, scale, area and openings", () => {
  const response = {
    format: "legacy",
    data: {
      vector_data: {
        version: "test",
        unit: "mm",
        scale_factor: 10,
        canvas: { width: 800, height: 600 },
        walls: [{ type: "wall" }],
        rooms: [{
          type: "living",
          name: "거실",
          vertices: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 500 }],
          center: { x: 300, y: 350 },
          area_mm2: 12_000_000,
          area_m2: 12,
        }],
        symbols: [{
          type: "door",
          type_ko: "문",
          confidence: 0.9,
          bbox: { x1: 20, y1: 30, x2: 110, y2: 50 },
          center: { x: 65, y: 40 },
        }],
        texts: [],
      },
      timing: {},
      summary: { symbols: 1, texts: 0, walls: 1, rooms: 1 },
    },
  } as FloorplanAIResponse;

  const result = floorplanAIToStructure(response);
  assert.deepEqual(result.rooms?.[0], {
    name: "거실",
    xMm: 100,
    yMm: 200,
    widthMm: 400,
    depthMm: 300,
  });
  assert.equal(result.openings?.[0]?.widthMm, 900);
  assert.equal(result.detectedAreaM2, 12);
  assert.equal(result.totalWidthMm, 8_000);
  assert.equal(result.totalDepthMm, 6_000);
});

test("v4.7 inference derives shell bounds and keeps measured room area", () => {
  const response = {
    format: "v47",
    data: {
      success: true,
      project: {
        meta: { mm_per_px: 10, scale_status: "measured" },
        walls: [
          { x0_mm: 100, y0_mm: 200, x1_mm: 5_100, y1_mm: 200 },
          { x0_mm: 5_100, y0_mm: 200, x1_mm: 5_100, y1_mm: 4_200 },
        ],
        rooms: [{ id: "r1", name: "침실", type: "bedroom", center_px: [250, 220], area_m2: 16 }],
        openings: [{ id: "o1", type: "window", widthMm: 1_800 }],
      },
    },
  } as unknown as FloorplanAIResponse;

  const result = floorplanAIToStructure(response);
  assert.equal(result.detectedAreaM2, 16);
  assert.equal(result.rooms?.[0]?.widthMm, 4_000);
  assert.equal(result.totalWidthMm, 5_000);
  assert.equal(result.totalDepthMm, 4_000);
  assert.equal(result.openings?.[0]?.type, "window");
});
