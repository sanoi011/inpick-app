// src/lib/floor-plan/drawing/svg-generators.ts
// 시공도면 SVG 생성기 — 서버사이드 실행 (Node.js, React 아님)

import type { FloorPlanProject } from '@/types/floor-plan';
import type {
  WallElevation,
  ElectricalPlacement, FurnitureSymbol,
} from '@/types/construction-drawing';
import { calcWallLength, calcCentroid, calcPolygonArea } from '../quantity/geometry';
import {
  DRAWING_COLORS as C,
  SVG_WIDTH, SVG_HEIGHT, LAYOUT, FONT,
  FURNITURE_SIZES, ROOM_DEFAULT_FURNITURE,
} from './drawing-constants';

// ─── SVG 유틸리티 ───

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgRect(x: number, y: number, w: number, h: number, fill: string, stroke?: string, strokeWidth?: number): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth || 1}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${s}/>`;
}

function svgLine(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number, dash?: string): string {
  const d = dash ? ` stroke-dasharray="${dash}"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}"${d}/>`;
}

function svgText(x: number, y: number, text: string, fill: string, fontSize: number, anchor: string = 'middle', rotate?: number): string {
  const transform = rotate ? ` transform="rotate(${rotate},${x},${y})"` : '';
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-family="'Nanum Gothic',sans-serif" text-anchor="${anchor}" dominant-baseline="central"${transform}>${esc(text)}</text>`;
}

function svgCircle(cx: number, cy: number, r: number, fill: string, stroke?: string, strokeWidth?: number): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth || 1}"` : '';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${s}/>`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatMm(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(mm % 1000 === 0 ? 0 : 1)}m`;
  }
  return `${Math.round(mm)}`;
}

// ─── 1. 가구배치도 (Furniture Layout Plan) ───

export function generateFurnitureLayoutSVG(
  project: FloorPlanProject,
  furnitureSymbols?: FurnitureSymbol[]
): string {
  const furniture = furnitureSymbols || autoPlaceFurniture(project);

  // 바운딩 박스 계산
  const allPoints = project.rooms.flatMap(r => r.polygon);
  const minX = Math.min(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const maxY = Math.max(...allPoints.map(p => p.y));

  const floorW = maxX - minX;
  const floorH = maxY - minY;

  // 스케일 계산 (여백 포함)
  const drawableW = SVG_WIDTH - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT;
  const drawableH = SVG_HEIGHT - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM - LAYOUT.TITLE_HEIGHT;
  const scale = Math.min(drawableW / floorW, drawableH / floorH) * 0.85;

  const offsetX = LAYOUT.MARGIN_LEFT + (drawableW - floorW * scale) / 2;
  const offsetY = LAYOUT.MARGIN_TOP + LAYOUT.TITLE_HEIGHT + (drawableH - floorH * scale) / 2;

  const tx = (x: number) => offsetX + (x - minX) * scale;
  const ty = (y: number) => offsetY + (y - minY) * scale;

  const parts: string[] = [];

  // SVG 헤더 + 배경
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`);
  parts.push(svgRect(0, 0, SVG_WIDTH, SVG_HEIGHT, C.BG));

  // 타이틀
  parts.push(svgText(SVG_WIDTH / 2, 35, '가구배치도 (Furniture Layout Plan)', C.TITLE, FONT.TITLE));
  parts.push(svgText(SVG_WIDTH / 2, 58, `총면적: ${project.totalArea.toFixed(1)}㎡ | 축척 미표기`, C.SUBTITLE, FONT.SUBTITLE));

  // 방 채우기
  for (const room of project.rooms) {
    if (room.polygon.length < 3) continue;
    const points = room.polygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');
    parts.push(`<polygon points="${points}" fill="${C.ROOM_FILL}" stroke="none"/>`);
  }

  // 벽체
  for (const wall of project.walls) {
    const x1 = tx(wall.start.x), y1 = ty(wall.start.y);
    const x2 = tx(wall.end.x), y2 = ty(wall.end.y);
    const thickness = Math.max(2, wall.thickness * scale);
    parts.push(svgLine(x1, y1, x2, y2, C.WALL_LINE, thickness));
  }

  // 개구부
  for (const opening of project.openings) {
    const wall = project.walls.find(w => w.id === opening.wallId);
    if (!wall) continue;

    const wallLen = calcWallLength(wall);
    if (wallLen === 0) continue;

    // 벽 중앙 부근에 배치 (개구부 정확한 위치 정보 없으므로)
    const t = 0.5;
    const ox = tx(wall.start.x + (wall.end.x - wall.start.x) * t);
    const oy = ty(wall.start.y + (wall.end.y - wall.start.y) * t);
    const openingW = opening.width * scale;

    if (opening.spec.kind === 'DOOR') {
      // 문: 주황색 아크
      parts.push(svgLine(ox - openingW / 2, oy, ox + openingW / 2, oy, C.DOOR, 2));
    } else {
      // 창문: 하늘색 이중선
      parts.push(svgLine(ox - openingW / 2, oy - 2, ox + openingW / 2, oy - 2, C.WINDOW, 1.5));
      parts.push(svgLine(ox - openingW / 2, oy + 2, ox + openingW / 2, oy + 2, C.WINDOW, 1.5));
    }
  }

  // 가구 심볼
  for (const f of furniture) {
    const fx = tx(f.positionMm.x);
    const fy = ty(f.positionMm.y);
    const fw = f.widthMm * scale;
    const fh = f.heightMm * scale;
    const size = FURNITURE_SIZES[f.type];

    if (f.rotation !== 0) {
      parts.push(`<g transform="rotate(${f.rotation},${fx},${fy})">`);
    }
    parts.push(svgRect(fx - fw / 2, fy - fh / 2, fw, fh, C.FURNITURE_FILL, C.FURNITURE, 1));
    if (size) {
      parts.push(svgText(fx, fy, size.label, C.LABEL, FONT.FURNITURE_LABEL));
    }
    if (f.rotation !== 0) {
      parts.push('</g>');
    }
  }

  // 방 이름 라벨
  for (const room of project.rooms) {
    const center = room.center || calcCentroid(room.polygon);
    const cx = tx(center.x);
    const cy = ty(center.y);
    const area = calcPolygonArea(room.polygon);
    parts.push(svgText(cx, cy - 8, room.name, C.LABEL, FONT.ROOM_NAME));
    parts.push(svgText(cx, cy + 10, `${area.toFixed(1)}㎡`, C.DIM_TEXT, FONT.DIM_TEXT));
  }

  // INPICK 워터마크
  parts.push(svgText(SVG_WIDTH - 20, SVG_HEIGHT - 15, 'INPICK', C.LABEL, 10, 'end'));

  parts.push('</svg>');
  return parts.join('\n');
}

// ─── 자동 가구 배치 알고리즘 ───

function autoPlaceFurniture(project: FloorPlanProject): FurnitureSymbol[] {
  const furniture: FurnitureSymbol[] = [];

  for (const room of project.rooms) {
    const defaultSet = ROOM_DEFAULT_FURNITURE[room.type];
    if (!defaultSet) continue;

    const center = room.center || calcCentroid(room.polygon);

    // 바운딩 박스
    const xs = room.polygon.map(p => p.x);
    const ys = room.polygon.map(p => p.y);
    const roomMinX = Math.min(...xs);
    const roomMinY = Math.min(...ys);
    const roomW = Math.max(...xs) - roomMinX;
    const roomH = Math.max(...ys) - roomMinY;

    // 장변/단변 파악
    const isWide = roomW >= roomH;
    const longAxis = isWide ? roomW : roomH;

    let offsetIndex = 0;
    for (const furnitureType of defaultSet) {
      const size = FURNITURE_SIZES[furnitureType];
      if (!size) continue;

      // 간단한 배치: 방 안에 균등 분배
      const count = defaultSet.length;
      const spacing = longAxis / (count + 1);
      const idx = offsetIndex++;

      let px: number, py: number;
      let rotation = 0;

      if (isWide) {
        px = roomMinX + spacing * (idx + 1);
        py = center.y;
      } else {
        px = center.x;
        py = roomMinY + spacing * (idx + 1);
      }

      // 침대 → 벽에 붙이기
      if (furnitureType.includes('bed')) {
        if (isWide) {
          py = roomMinY + size.h / 2 + 100;
        } else {
          px = roomMinX + size.w / 2 + 100;
          rotation = 90;
        }
      }

      furniture.push({
        type: furnitureType as FurnitureSymbol['type'],
        roomId: room.id,
        positionMm: { x: Math.round(px), y: Math.round(py) },
        widthMm: size.w,
        heightMm: size.h,
        rotation,
      });
    }
  }

  return furniture;
}

// ─── 2. 전기배선도 (Electrical Plan) ───

export function generateElectricalPlanSVG(
  project: FloorPlanProject,
  electricalPlacements: Map<string, ElectricalPlacement[]>
): string {
  // 바운딩 박스 계산
  const allPoints = project.rooms.flatMap(r => r.polygon);
  const minX = Math.min(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const maxY = Math.max(...allPoints.map(p => p.y));

  const floorW = maxX - minX;
  const floorH = maxY - minY;

  const drawableW = SVG_WIDTH - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT;
  const drawableH = SVG_HEIGHT - LAYOUT.MARGIN_TOP - LAYOUT.MARGIN_BOTTOM - LAYOUT.TITLE_HEIGHT - 80;
  const scale = Math.min(drawableW / floorW, drawableH / floorH) * 0.8;

  const offsetX = LAYOUT.MARGIN_LEFT + (drawableW - floorW * scale) / 2;
  const offsetY = LAYOUT.MARGIN_TOP + LAYOUT.TITLE_HEIGHT + (drawableH - floorH * scale) / 2;

  const tx = (x: number) => offsetX + (x - minX) * scale;
  const ty = (y: number) => offsetY + (y - minY) * scale;

  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`);
  parts.push(svgRect(0, 0, SVG_WIDTH, SVG_HEIGHT, C.BG));

  // 타이틀
  parts.push(svgText(SVG_WIDTH / 2, 35, '콘센트/스위치 위치도 (Socket/Switch Plan)', C.TITLE, FONT.TITLE));
  parts.push(svgText(SVG_WIDTH / 2, 58, `총면적: ${project.totalArea.toFixed(1)}㎡`, C.SUBTITLE, FONT.SUBTITLE));

  // 방 채우기
  for (const room of project.rooms) {
    if (room.polygon.length < 3) continue;
    const points = room.polygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');
    parts.push(`<polygon points="${points}" fill="${C.ROOM_FILL}" stroke="none"/>`);
  }

  // 벽체
  for (const wall of project.walls) {
    parts.push(svgLine(tx(wall.start.x), ty(wall.start.y), tx(wall.end.x), ty(wall.end.y), C.WALL_LINE, Math.max(2, wall.thickness * scale)));
  }

  // 개구부 (간략)
  for (const opening of project.openings) {
    const wall = project.walls.find(w => w.id === opening.wallId);
    if (!wall) continue;
    const ox = tx((wall.start.x + wall.end.x) / 2);
    const oy = ty((wall.start.y + wall.end.y) / 2);
    const color = opening.spec.kind === 'DOOR' ? C.DOOR : C.WINDOW;
    const ow = opening.width * scale;
    parts.push(svgLine(ox - ow / 2, oy, ox + ow / 2, oy, color, 2));
  }

  // 방 이름
  for (const room of project.rooms) {
    const center = room.center || calcCentroid(room.polygon);
    parts.push(svgText(tx(center.x), ty(center.y), room.name, C.LABEL, FONT.ROOM_NAME));
  }

  // 전기 심볼 배치
  for (const room of project.rooms) {
    const placements = electricalPlacements.get(room.id) || [];

    // 방 영역 내에 심볼 분배
    const xs = room.polygon.map(p => p.x);
    const ys = room.polygon.map(p => p.y);
    const roomMinX = Math.min(...xs);
    const roomMinY = Math.min(...ys);
    const roomW = Math.max(...xs) - roomMinX;
    const roomH = Math.max(...ys) - roomMinY;

    placements.forEach((p, idx) => {
      // 방 안에 그리드 배치
      const cols = Math.ceil(Math.sqrt(placements.length));
      const rows = Math.ceil(placements.length / cols);
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const px = tx(roomMinX + roomW * (col + 0.5) / cols);
      const py = ty(roomMinY + roomH * (row + 0.5) / rows);

      if (p.type.startsWith('switch') || p.type === 'light_switch') {
        // 스위치: 녹색 사각형
        parts.push(svgRect(px - 5, py - 5, 10, 10, 'none', C.ELEC_SWITCH, 1.5));
        parts.push(svgText(px, py + 14, 'S', C.ELEC_SWITCH, FONT.ELEC_LABEL));
      } else if (p.type === 'tv_outlet') {
        // TV: 보라색 원
        parts.push(svgCircle(px, py, 6, 'none', C.ELEC_TV, 1.5));
        parts.push(svgText(px, py + 14, 'TV', C.ELEC_TV, FONT.ELEC_LABEL));
      } else if (p.type === 'ac_outlet') {
        // AC: 분홍색
        parts.push(svgCircle(px, py, 6, 'none', C.ELEC_SPECIAL, 1.5));
        parts.push(svgText(px, py + 14, 'AC', C.ELEC_SPECIAL, FONT.ELEC_LABEL));
      } else if (p.type === 'gas_valve') {
        // 가스: 주황 삼각
        parts.push(`<polygon points="${px},${py - 6} ${px + 6},${py + 4} ${px - 6},${py + 4}" fill="none" stroke="${C.ELEC_OUTLET}" stroke-width="1.5"/>`);
        parts.push(svgText(px, py + 14, 'G', C.ELEC_OUTLET, FONT.ELEC_LABEL));
      } else if (p.type === 'exhaust_fan') {
        // 환풍기: 팬 아이콘 (원 + 십자)
        parts.push(svgCircle(px, py, 7, 'none', C.ELEC_DATA, 1));
        parts.push(svgLine(px - 5, py, px + 5, py, C.ELEC_DATA, 1));
        parts.push(svgLine(px, py - 5, px, py + 5, C.ELEC_DATA, 1));
      } else if (p.type === 'fire_detector') {
        // 화재감지기: 빨간 점
        parts.push(svgCircle(px, py, 4, '#FF4444'));
      } else {
        // 일반 콘센트: 주황색 원
        parts.push(svgCircle(px, py, 5, 'none', C.ELEC_OUTLET, 1.5));
      }
    });
  }

  // 범례
  const legendY = SVG_HEIGHT - 60;
  const legendItems = [
    { symbol: 'circle', color: C.ELEC_OUTLET, label: '콘센트' },
    { symbol: 'square', color: C.ELEC_SWITCH, label: '스위치' },
    { symbol: 'circle', color: C.ELEC_TV, label: 'TV/데이터' },
    { symbol: 'circle', color: C.ELEC_SPECIAL, label: '에어컨' },
    { symbol: 'triangle', color: C.ELEC_OUTLET, label: '가스밸브' },
  ];
  let legendX = 80;
  for (const item of legendItems) {
    if (item.symbol === 'circle') {
      parts.push(svgCircle(legendX, legendY, 5, 'none', item.color, 1.5));
    } else if (item.symbol === 'square') {
      parts.push(svgRect(legendX - 5, legendY - 5, 10, 10, 'none', item.color, 1.5));
    } else {
      parts.push(`<polygon points="${legendX},${legendY - 5} ${legendX + 5},${legendY + 4} ${legendX - 5},${legendY + 4}" fill="none" stroke="${item.color}" stroke-width="1.5"/>`);
    }
    parts.push(svgText(legendX + 14, legendY, item.label, C.DIM_TEXT, FONT.ELEC_LABEL, 'start'));
    legendX += 100;
  }

  parts.push(svgText(SVG_WIDTH - 20, SVG_HEIGHT - 15, 'INPICK', C.LABEL, 10, 'end'));
  parts.push('</svg>');
  return parts.join('\n');
}

// ─── 3. 입면전개도 (Wall Elevation Drawing) ───

export function generateElevationSVG(
  elevation: WallElevation,
  roomName: string,
  renderImagePlaceholder: boolean = true
): string {
  const { wallLengthMm, wallHeightMm, openings, fixtures, materials, electricalPlacements, wallLabel } = elevation;

  // 입면도 영역 계산
  const drawableW = SVG_WIDTH - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT;
  const elevationAreaH = renderImagePlaceholder ? (SVG_HEIGHT * 0.55) : (SVG_HEIGHT * 0.75);
  const elevDrawableH = elevationAreaH - LAYOUT.MARGIN_TOP - LAYOUT.TITLE_HEIGHT - 40;

  const scaleX = drawableW * 0.85 / wallLengthMm;
  const scaleY = elevDrawableH * 0.7 / wallHeightMm;
  const scale = Math.min(scaleX, scaleY);

  const wallW = wallLengthMm * scale;
  const wallH = wallHeightMm * scale;

  const wallLeft = (SVG_WIDTH - wallW) / 2;
  const wallTop = LAYOUT.MARGIN_TOP + LAYOUT.TITLE_HEIGHT + 20;
  const wallBottom = wallTop + wallH;

  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`);
  parts.push(svgRect(0, 0, SVG_WIDTH, SVG_HEIGHT, C.BG));

  // 타이틀
  parts.push(svgText(SVG_WIDTH / 2, 30, `${roomName} ${wallLabel}면 입면전개도`, C.TITLE, FONT.TITLE));
  parts.push(svgText(SVG_WIDTH / 2, 52, `Wall Elevation - ${wallLengthMm}mm × ${wallHeightMm}mm`, C.SUBTITLE, FONT.SUBTITLE - 1));

  // 벽면 직사각형
  parts.push(svgRect(wallLeft, wallTop, wallW, wallH, C.ROOM_FILL, C.WALL_LINE, 1.5));

  // 바닥선 (두꺼운 선)
  parts.push(svgLine(wallLeft - 20, wallBottom, wallLeft + wallW + 20, wallBottom, C.WALL_LINE, 2));

  // 천장선 (점선)
  parts.push(svgLine(wallLeft - 10, wallTop, wallLeft + wallW + 10, wallTop, C.DIM_LINE, 1, '4,4'));

  // 개구부 렌더링
  for (const opening of openings) {
    const ox = wallLeft + opening.positionFromLeftMm * scale - (opening.widthMm * scale) / 2;
    const oy = wallBottom - opening.sillHeightMm * scale - opening.heightMm * scale;
    const ow = opening.widthMm * scale;
    const oh = opening.heightMm * scale;

    if (opening.type === 'window') {
      // 창문: 하늘색 직사각형 + X 유리 패턴
      parts.push(svgRect(ox, oy, ow, oh, 'none', C.WINDOW, 1.5));
      parts.push(svgLine(ox, oy, ox + ow, oy + oh, C.WINDOW, 0.5, '2,3'));
      parts.push(svgLine(ox + ow, oy, ox, oy + oh, C.WINDOW, 0.5, '2,3'));
      // 창턱선
      parts.push(svgLine(ox - 5, oy + oh, ox + ow + 5, oy + oh, C.WINDOW, 1.5));
    } else {
      // 문: 주황색 직사각형
      parts.push(svgRect(ox, oy, ow, oh, 'none', C.DOOR, 1.5));
      // 문 패널
      const panelInset = Math.min(8, ow * 0.08);
      parts.push(svgRect(ox + panelInset, oy + panelInset, ow - panelInset * 2, oh * 0.4, 'none', C.DOOR, 0.5));
      parts.push(svgRect(ox + panelInset, oy + oh * 0.5, ow - panelInset * 2, oh * 0.4, 'none', C.DOOR, 0.5));
    }

    // 개구부 치수
    parts.push(svgText(
      ox + ow / 2, oy - 8,
      `${opening.widthMm}×${opening.heightMm}`,
      C.DIM_TEXT, FONT.DIM_TEXT
    ));
  }

  // 설비 렌더링
  for (const fixture of fixtures) {
    const fx = wallLeft + fixture.positionFromLeftMm * scale - (fixture.widthMm * scale) / 2;
    const fy = wallBottom - fixture.heightFromFloorMm * scale - fixture.heightMm * scale;
    const fw = fixture.widthMm * scale;
    const fh = fixture.heightMm * scale;

    parts.push(svgRect(fx, fy, fw, fh, C.FURNITURE_FILL, C.FURNITURE, 1));
    if (fixture.label) {
      parts.push(svgText(fx + fw / 2, fy + fh / 2, fixture.label, C.LABEL, FONT.ANNOTATION));
    }
  }

  // 전기 심볼 렌더링
  for (const ep of electricalPlacements) {
    const ex = wallLeft + ep.positionFromLeftMm * scale;
    const ey = wallBottom - ep.heightFromFloorMm * scale;

    if (ep.type.startsWith('switch') || ep.type === 'light_switch') {
      parts.push(svgRect(ex - 4, ey - 4, 8, 8, 'none', C.ELEC_SWITCH, 1));
    } else if (ep.type === 'tv_outlet') {
      parts.push(svgCircle(ex, ey, 5, 'none', C.ELEC_TV, 1));
    } else if (ep.type === 'ac_outlet') {
      parts.push(svgCircle(ex, ey, 5, 'none', C.ELEC_SPECIAL, 1));
    } else {
      parts.push(svgCircle(ex, ey, 4, 'none', C.ELEC_OUTLET, 1));
    }
    // 높이 주석
    parts.push(svgText(ex + 10, ey, `h=${ep.heightFromFloorMm}`, C.DIM_TEXT, 7, 'start'));
  }

  // 치수선 ─ 가로 (벽면 길이)
  const dimY = wallBottom + 25;
  parts.push(svgLine(wallLeft, dimY, wallLeft + wallW, dimY, C.DIM_LINE, 0.8));
  // 틱마크
  parts.push(svgLine(wallLeft, dimY - LAYOUT.DIM_TICK_SIZE, wallLeft, dimY + LAYOUT.DIM_TICK_SIZE, C.DIM_LINE, 0.8));
  parts.push(svgLine(wallLeft + wallW, dimY - LAYOUT.DIM_TICK_SIZE, wallLeft + wallW, dimY + LAYOUT.DIM_TICK_SIZE, C.DIM_LINE, 0.8));
  // 치수 텍스트
  parts.push(svgText(wallLeft + wallW / 2, dimY + 14, `${wallLengthMm}`, C.DIM_TEXT, FONT.DIM_TEXT));

  // 치수선 ─ 세로 (벽면 높이)
  const dimX = wallLeft - 25;
  parts.push(svgLine(dimX, wallTop, dimX, wallBottom, C.DIM_LINE, 0.8));
  parts.push(svgLine(dimX - LAYOUT.DIM_TICK_SIZE, wallTop, dimX + LAYOUT.DIM_TICK_SIZE, wallTop, C.DIM_LINE, 0.8));
  parts.push(svgLine(dimX - LAYOUT.DIM_TICK_SIZE, wallBottom, dimX + LAYOUT.DIM_TICK_SIZE, wallBottom, C.DIM_LINE, 0.8));
  parts.push(svgText(dimX - 12, wallTop + wallH / 2, `${wallHeightMm}`, C.DIM_TEXT, FONT.DIM_TEXT, 'middle', -90));

  // 개구부 간 구간 치수
  if (openings.length > 0) {
    const sortedOpenings = [...openings].sort((a, b) => a.positionFromLeftMm - b.positionFromLeftMm);
    const segDimY = dimY + 30;

    let prevRight = 0;
    for (const opening of sortedOpenings) {
      const leftEdge = opening.positionFromLeftMm - opening.widthMm / 2;
      const rightEdge = opening.positionFromLeftMm + opening.widthMm / 2;

      if (leftEdge > prevRight + 100) {
        const segStart = wallLeft + prevRight * scale;
        const segEnd = wallLeft + leftEdge * scale;
        const segLen = Math.round(leftEdge - prevRight);
        parts.push(svgLine(segStart, segDimY, segEnd, segDimY, C.DIM_LINE, 0.5));
        parts.push(svgText((segStart + segEnd) / 2, segDimY - 6, `${segLen}`, C.DIM_TEXT, 8));
      }
      prevRight = rightEdge;
    }
    // 마지막 구간
    if (wallLengthMm - prevRight > 100) {
      const segStart = wallLeft + prevRight * scale;
      const segEnd = wallLeft + wallW;
      parts.push(svgLine(segStart, segDimY, segEnd, segDimY, C.DIM_LINE, 0.5));
      parts.push(svgText((segStart + segEnd) / 2, segDimY - 6, `${Math.round(wallLengthMm - prevRight)}`, C.DIM_TEXT, 8));
    }
  }

  // 자재 주석
  if (materials.length > 0) {
    let annotY = wallTop - 15;
    for (const mat of materials) {
      const areaLabel = mat.area === 'floor' ? '바닥' : mat.area === 'wall' ? '벽' : '천장';
      const text = `[${areaLabel}] ${mat.name}${mat.specification ? ` (${mat.specification})` : ''}`;
      parts.push(svgRect(wallLeft + wallW + 15, annotY - 8, 200, 16, C.ANNOTATION_BG, C.ANNOTATION, 0.5));
      parts.push(svgText(wallLeft + wallW + 20, annotY, text, C.ANNOTATION, FONT.ANNOTATION, 'start'));
      annotY += 20;
    }
  }

  // 렌더 이미지 영역 (하단)
  if (renderImagePlaceholder) {
    const renderTop = elevationAreaH + 10;
    const renderH = SVG_HEIGHT - renderTop - 30;
    parts.push(svgRect(LAYOUT.MARGIN_LEFT, renderTop, SVG_WIDTH - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT, renderH, C.BG_LIGHTER, C.RENDER_BORDER, 1));
    parts.push(svgText(SVG_WIDTH / 2, renderTop + renderH / 2, '3D 인테리어 렌더 이미지', C.LABEL, FONT.SUBTITLE));
  }

  parts.push(svgText(SVG_WIDTH - 20, SVG_HEIGHT - 15, 'INPICK', C.LABEL, 10, 'end'));
  parts.push('</svg>');
  return parts.join('\n');
}
