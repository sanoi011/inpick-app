/**
 * Elevation wall → SVG renderer (deterministic).
 *
 * 가이드: §12-4
 *
 * 정책:
 *   - mm 단위 좌표 → 0.2px scale (자동 fit)
 *   - 검은선 0.5pt, dimension 회색 0.3pt
 *   - opening은 점선/얇은선
 *   - text NanumGothic (CSS font-family)
 */
import type { ElevationWallSpec } from "./elevation-types";

const SCALE_PX_PER_MM = 0.2;

export function renderElevationWallSvg(wall: ElevationWallSpec): string {
  const wPx = Math.max(200, wall.widthMm * SCALE_PX_PER_MM);
  const hPx = Math.max(150, wall.heightMm * SCALE_PX_PER_MM);
  const margin = 50; // for dimension/title

  const viewW = wPx + margin * 2;
  const viewH = hPx + margin * 2;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" font-family="NanumGothic, sans-serif">`,
  );
  parts.push(`<style>
    .wall { fill: none; stroke: #1a1a1a; stroke-width: 1.2; }
    .opening { fill: none; stroke: #2a2a2a; stroke-width: 0.8; stroke-dasharray: 3 2; }
    .opening-label { font-size: 8px; fill: #444; }
    .dim { stroke: #666; stroke-width: 0.5; }
    .dim-text { font-size: 8px; fill: #333; }
    .title { font-size: 13px; fill: #111; font-weight: bold; }
    .meta { font-size: 9px; fill: #555; }
    .finish { font-size: 7px; fill: #555; }
    .warning { font-size: 8px; fill: #c2410c; }
  </style>`);

  // 제목
  parts.push(
    `<text x="${margin}" y="20" class="title">${escapeXml(wall.roomName)} — Wall ${wall.wallLabel}${wall.direction ? ` (${wall.direction})` : ""}</text>`,
  );

  // 메타
  parts.push(
    `<text x="${margin}" y="35" class="meta">${wall.widthMm}mm × ${wall.heightMm}mm · 신뢰도 ${Math.round(wall.confidence * 100)}%</text>`,
  );

  // 벽 사각형
  const wallX = margin;
  const wallY = margin;
  parts.push(`<rect class="wall" x="${wallX}" y="${wallY}" width="${wPx}" height="${hPx}"/>`);

  // openings
  for (const op of wall.openings) {
    const opX = wallX + op.xMm * SCALE_PX_PER_MM;
    const opY = wallY + (wall.heightMm - op.yMm - op.heightMm) * SCALE_PX_PER_MM;
    const opW = op.widthMm * SCALE_PX_PER_MM;
    const opH = op.heightMm * SCALE_PX_PER_MM;
    parts.push(`<rect class="opening" x="${opX}" y="${opY}" width="${opW}" height="${opH}"/>`);
    parts.push(
      `<text class="opening-label" x="${opX + opW / 2}" y="${opY - 2}" text-anchor="middle">${escapeXml(op.label)}</text>`,
    );
  }

  // dimensions
  for (const dim of wall.dimensions) {
    const fx = wallX + dim.from.xMm * SCALE_PX_PER_MM;
    const fy = wallY + (wall.heightMm - dim.from.yMm) * SCALE_PX_PER_MM;
    const tx = wallX + dim.to.xMm * SCALE_PX_PER_MM;
    const ty = wallY + (wall.heightMm - dim.to.yMm) * SCALE_PX_PER_MM;
    parts.push(`<line class="dim" x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}"/>`);
    parts.push(
      `<text class="dim-text" x="${(fx + tx) / 2}" y="${(fy + ty) / 2 - 2}" text-anchor="middle">${escapeXml(dim.label)}</text>`,
    );
  }

  // 자재 정보 (좌측 하단)
  let finishY = wallY + hPx + 18;
  parts.push(`<text x="${margin}" y="${finishY}" class="meta" font-weight="bold">마감재</text>`);
  finishY += 10;
  for (const f of wall.finishes.slice(0, 5)) {
    const label = f.materialProductId
      ? `[확정] ${f.brand || ""} ${f.productName || ""} ${f.sku ? `(${f.sku})` : ""}`
      : `[기본] ${f.surfaceType} 표준 자재`;
    parts.push(`<text x="${margin}" y="${finishY}" class="finish">${escapeXml(label)}</text>`);
    finishY += 10;
  }

  // warnings
  if (wall.warnings.length > 0) {
    finishY += 5;
    parts.push(`<text x="${margin}" y="${finishY}" class="warning">⚠ ${escapeXml(wall.warnings[0])}</text>`);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
