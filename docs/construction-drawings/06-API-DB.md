# 06. API 라우트 + DB 스키마 + UI 컴포넌트

## API 라우트

### POST /api/project/generate-drawings

**역할**: SSE 7단계 파이프라인으로 시공도면 세트 생성
**파일**: `src/app/api/project/generate-drawings/route.ts`

**요청**:
```json
{ "contractId": "uuid" }
```

**응답**: SSE (text/event-stream)
```
data: {"step":0,"progress":3,"message":"계약 정보 로드 중..."}
data: {"step":1,"progress":15,"message":"입면도 계산 중..."}
...
data: {"step":6,"progress":100,"message":"완료","result":{...}}
```

**에러 이벤트**:
```
data: {"error":"계약 정보를 찾을 수 없습니다","step":0}
```

**서버 설정**:
- `maxDuration = 300` (Vercel Pro 5분)
- Supabase Storage 업로드: `construction-drawings/{drawingId}.svg`

### GET /api/project/generate-drawings?contractId=xxx

**역할**: 기존 생성된 도면 세트 조회
**응답**:
```json
{
  "exists": true,
  "drawingSet": { "id": "...", "status": "completed", "pdfUrl": "..." },
  "drawings": [
    { "id": "...", "drawingType": "furniture_layout", "svgUrl": "...", "metadata": {...} }
  ]
}
```

### POST /api/project/generate-elevation (레거시)

**역할**: 참고 이미지 + 도면 → Gemini Pro → 입면도 JSON
**파일**: `src/app/api/project/generate-elevation/route.ts`
**상태**: 구현 완료, 현재 미사용 (generate-drawings로 대체)

## DB 스키마

### construction_drawing_sets
```sql
CREATE TABLE construction_drawing_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL,
  consumer_project_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  pdf_url TEXT,
  total_pages INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,     -- 0-100
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### construction_drawings
```sql
CREATE TABLE construction_drawings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES construction_drawing_sets(id) ON DELETE CASCADE,
  drawing_type TEXT NOT NULL
    CHECK (drawing_type IN (
      'cover_page','furniture_layout','electrical_plan',
      'elevation_living','elevation_kitchen',
      'elevation_master_bed','elevation_bathroom1',
      'elevation_bathroom2','elevation_bed'
    )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  svg_url TEXT,
  ai_enhanced_url TEXT,
  final_url TEXT,
  metadata JSONB DEFAULT '{}',
  -- metadata: { roomId, roomName, wallLabel, wallLengthMm, wallHeightMm }
  error_message TEXT,
  processing_time_ms INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 마이그레이션
- 파일: `supabase/migrations/20260223100000_construction_drawings.sql`
- 상태: Supabase 적용 완료

### Supabase Storage
- 버킷: `construction-drawings` (생성 필요)
- 경로: `construction-drawings/{drawingId}.svg`
- 접근: public 읽기

## UI 컴포넌트

### DrawingGenerationProgress
**파일**: `src/components/contract/DrawingGenerationProgress.tsx`

**Props**:
```typescript
{
  contractId: string;
  onComplete: (result: DrawingSetResult) => void;
  onCancel: () => void;
}
```

**기능**:
- SSE fetch → ReadableStream 파싱
- 7단계 시각적 인디케이터 (CheckCircle/Loader2)
- 프로그레스 바 (0-100%)
- 에러 시 재시도 버튼
- 완료 시 onComplete 콜백

### DrawingViewer
**파일**: `src/components/contract/DrawingViewer.tsx`

**Props**:
```typescript
{
  drawings: ConstructionDrawing[];
  pdfUrl?: string;
}
```

**기능**:
- 썸네일 그리드 → 클릭 시 풀스크린 모달
- 도면별 메타데이터 표시 (방 이름, 벽면, 치수)
- PDF 다운로드 버튼

## 통합 위치

### 소비자 계약 상세 (`contract/[id]/page.tsx`)
```jsx
// 시공도면 섹션
<section>
  <h3>시공도면</h3>
  {!drawingSet && (
    <button onClick={() => setShowGenerateDrawings(true)}>
      시공도면 생성하기
    </button>
  )}
  {showGenerateDrawings && (
    <DrawingGenerationProgress
      contractId={contract.id}
      onComplete={handleDrawingComplete}
      onCancel={() => setShowGenerateDrawings(false)}
    />
  )}
  {drawingSet && (
    <DrawingViewer
      drawings={drawingSet.drawings}
      pdfUrl={drawingSet.pdfUrl}
    />
  )}
</section>
```

### 사업자 프로젝트 (`contractor/projects/page.tsx`)
- 각 프로젝트 카드에 "시공도면 보기" 링크
- 계약 상세 페이지로 이동하여 도면 확인
