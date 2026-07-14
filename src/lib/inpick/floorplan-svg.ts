/**
 * 평면도 치수 오버레이 SVG — raster 평면도 위에 absolute 레이어로 얹힘.
 *
 * 입력: Vision이 추출한 실 layout (mm 좌표) + 도면 전체 크기
 * 출력: SVG (배경 투명, 치수 라벨/연결선만)
 *
 * 사용: <img src={cleanedRaster} /> + <div dangerouslySetInnerHTML={dimensionSvg} className="absolute inset-0" />
 */

export interface FloorRoomLayout {
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
}

export interface DimensionOverlayInput {
  rooms: FloorRoomLayout[];
  totalWidthMm: number;
  totalDepthMm: number;
  showRoomLabels?: boolean;       // 실명 라벨
  showRoomDimensions?: boolean;   // 실별 치수
  showOuterDimensions?: boolean;  // 전체 외곽 치수
}

export function buildDimensionOverlaySvg(input: DimensionOverlayInput): string {
  const {
    rooms,
    totalWidthMm,
    totalDepthMm,
    showRoomLabels = true,
    showRoomDimensions = true,
    showOuterDimensions = true,
  } = input;

  if (!rooms.length) return "";

  // viewBox는 도면 mm 단위 그대로
  const labelFs = Math.round(totalWidthMm / 50);
  const dimFs = Math.round(labelFs * 0.85);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidthMm} ${totalDepthMm}" preserveAspectRatio="none" font-family="Pretendard, Apple SD Gothic Neo, sans-serif" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
  <style>
    .room-label-bg { fill: rgba(255,255,255,0.92); }
    .room-label { font-size: ${labelFs}px; font-weight: 700; fill: #1a1a1a; text-anchor: middle; }
    .room-dim { font-size: ${dimFs}px; font-weight: 500; fill: #555; text-anchor: middle; }
    .outer-dim-line { stroke: #111111; stroke-width: 6; }
    .outer-dim-tick { stroke: #111111; stroke-width: 6; }
    .outer-dim-text { font-size: ${labelFs}px; font-weight: 700; fill: #111111; text-anchor: middle; }
  </style>`;

  if (showRoomLabels || showRoomDimensions) {
    for (const r of rooms) {
      const cx = r.xMm + r.widthMm / 2;
      const cy = r.yMm + r.depthMm / 2;
      const labelW = labelFs * 6;
      const labelH = (showRoomDimensions ? labelFs * 2.6 : labelFs * 1.4);

      // 라벨 배경 박스 (가독성)
      svg += `<rect class="room-label-bg" x="${cx - labelW / 2}" y="${cy - labelH / 2}" width="${labelW}" height="${labelH}" rx="${labelFs * 0.3}"/>`;

      if (showRoomLabels) {
        svg += `<text class="room-label" x="${cx}" y="${cy + labelFs * 0.3}">${r.name}</text>`;
      }
      if (showRoomDimensions) {
        const areaM2 = Math.round((r.widthMm * r.depthMm) / 10_000) / 100;
        svg += `<text class="room-dim" x="${cx}" y="${cy + labelFs * 1.3}">${r.widthMm}×${r.depthMm} · ${areaM2}㎡</text>`;
      }
    }
  }

  if (showOuterDimensions) {
    const off = totalWidthMm * 0.02;
    // 가로 외곽 (하단)
    const dimY = totalDepthMm - off;
    svg += `<line class="outer-dim-line" x1="${off}" y1="${dimY}" x2="${totalWidthMm - off}" y2="${dimY}"/>`;
    svg += `<line class="outer-dim-tick" x1="${off}" y1="${dimY - off}" x2="${off}" y2="${dimY + off}"/>`;
    svg += `<line class="outer-dim-tick" x1="${totalWidthMm - off}" y1="${dimY - off}" x2="${totalWidthMm - off}" y2="${dimY + off}"/>`;
    svg += `<rect class="room-label-bg" x="${totalWidthMm / 2 - labelFs * 4}" y="${dimY - labelFs * 1.4}" width="${labelFs * 8}" height="${labelFs * 1.4}" rx="${labelFs * 0.2}"/>`;
    svg += `<text class="outer-dim-text" x="${totalWidthMm / 2}" y="${dimY - labelFs * 0.3}">${totalWidthMm.toLocaleString()} mm</text>`;
    // 세로 외곽 (우측)
    const dimX = totalWidthMm - off;
    svg += `<line class="outer-dim-line" x1="${dimX}" y1="${off}" x2="${dimX}" y2="${totalDepthMm - off * 4}"/>`;
    svg += `<line class="outer-dim-tick" x1="${dimX - off}" y1="${off}" x2="${dimX + off}" y2="${off}"/>`;
    svg += `<line class="outer-dim-tick" x1="${dimX - off}" y1="${totalDepthMm - off * 4}" x2="${dimX + off}" y2="${totalDepthMm - off * 4}"/>`;
  }

  svg += `</svg>`;
  return svg;
}
