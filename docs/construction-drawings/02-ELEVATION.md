# 02. 입면전개도 엔진 상세 스펙

> 파일: `src/lib/floor-plan/elevation/elevation-calculator.ts` (411줄)

## 개념

입면전개도 = 방 내부에서 4방향(A/B/C/D) 벽면을 정면으로 바라본 도면.
각 벽면의 문/창문/설비/자재/전기 위치를 mm 단위로 표현.

## 핵심 함수

### `calculateRoomElevations(project, roomId, materials)`

**입력**:
- `project: FloorPlanProject` (mm 좌표 BIM 모델)
- `roomId: string`
- `materials?: ElevationMaterial[]` (선택: 자재 오버라이드)

**출력**: `WallElevation[]` (4면: A/B/C/D)

**처리 순서**:
1. `getOrderedWallsForRoom()` — 방 중심 기준 시계방향 정렬
2. 벽 중심선 → `wallLengthMm` 계산
3. `ceilingHeight` (기본 2400mm) → `wallHeightMm`
4. 개구부(문/창) 위치 계산 → `ElevationOpening`
5. `assignFixturesToWalls()` — 설비 → 가장 가까운 벽면 배정
6. 자재 정보 매핑

### `calculateAllElevations(project, materials)`

**기본 산출 대상** (5개 방 타입):
- LIVING_ROOM, KITCHEN, MASTER_BEDROOM, BATHROOM, BEDROOM

나머지는 사용자 요청 시 개별 호출.

## 데이터 구조

```typescript
interface WallElevation {
  wallId: string;
  wallLabel: 'A' | 'B' | 'C' | 'D';
  wallLengthMm: number;       // 벽면 가로 길이
  wallHeightMm: number;       // 벽면 높이 (기본 2400)
  openings: ElevationOpening[];
  fixtures: ElevationFixture[];
  materials: ElevationMaterial[];
  electricalPlacements: ElectricalPlacement[];
}

interface ElevationOpening {
  type: 'door' | 'window' | 'sliding_door' | 'entrance_door';
  positionFromLeftMm: number;  // 벽 좌측 끝에서의 거리
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;        // 하단 높이 (창문: ~900mm, 문: 0mm)
  label?: string;
}

interface ElevationFixture {
  type: string;                // TOILET, BASIN, BATHTUB, KITCHEN_SINK 등
  positionFromLeftMm: number;
  bottomMm: number;            // 바닥에서의 높이
  widthMm: number;
  heightMm: number;
}
```

## 설비 높이/크기 기준값 (mm)

### 높이 (바닥 기준)
| 설비 | 높이(mm) | 비고 |
|------|----------|------|
| TOILET | 0 | 바닥 직접 |
| BASIN | 800 | 표준 세면대 |
| BATHTUB | 0 | 바닥 직접 |
| SHOWER_BOOTH | 0 | 바닥 직접 |
| KITCHEN_SINK | 850 | 주방 조리대 |
| GAS_RANGE / INDUCTION | 850 | 주방 조리대 |
| RANGE_HOOD | 1600 | 가스레인지 상부 |
| KITCHEN_UPPER_CABINET | 1500 | 상부장 |
| AC_INDOOR | 2100 | 천장 근처 |

### 크기
| 설비 | 폭×높이(mm) |
|------|------------|
| TOILET | 400×700 |
| BASIN_CABINET | 600×500 |
| BATHTUB | 1500×500 |
| KITCHEN_SINK | 800×200 |
| RANGE_HOOD | 600×400 |
| KITCHEN_UPPER_CABINET | 2400×700 |
| WARDROBE | 1800×2200 |

## 벽면 정렬 알고리즘

```
1. 방에 속한 벽 ID 수집
2. 벽 중심점 계산
3. 방 중심에서 각 벽 중심까지 각도(atan2) 계산
4. 시계방향 정렬 → A(위/북), B(우/동), C(아래/남), D(좌/서) 할당
```

## 한계점 (구현 시 주의)

- 비직각 벽(사선벽)은 가장 가까운 직각으로 근사
- 5개 방 타입만 기본 산출 → 나머지 방은 수동 요청 필요
- 천장 높이 고정 2400mm → 층고 파라미터 전달 시 동적 대응 가능하지만 미적용
- 설비 크기는 한국 표준 기준 하드코딩 → 추후 DB 단가와 연동 필요
