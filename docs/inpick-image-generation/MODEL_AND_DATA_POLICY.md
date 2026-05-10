# InPick 이미지 생성 — 모델 + 데이터 정책

> 가이드: `c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md` §5, §8
> 작성일: 2026-05-10 · Phase 8

## 0. 한 줄

**구조 정확도는 LoRA가 아니라 geometry pipeline으로 해결한다. LoRA는 InPick 스타일 전용이다.**

## 1. 모델 정책

### 1-1. 등록 모델

| Model ID | License | Production | 용도 |
|---|---|---|---|
| `gpt-image-2` | OpenAI ToS | ✅ 허용 | 현재 production 백엔드 default |
| `black-forest-labs/FLUX.2-klein-4b` | Apache 2.0 | ✅ 허용 | RunPod default (가이드 권장) |
| `black-forest-labs/FLUX.1-dev` | Commercial license required | ❌ 차단 | PoC만. 상업 라이선스 확인 후 `BFL_COMMERCIAL_LICENSE_CONFIRMED=true` 시만 |

### 1-2. 정책 enforcement

- **Next.js**: `src/lib/inpick/image-backends/model-policy.ts` — `assertModelAllowedForRuntime()`
- **RunPod worker**: `runpod_serverless/inpick-renderer/pipelines/model_registry.py` — `assert_model_allowed()`
- 두 곳에서 같은 정책. 환경변수 `RENDERER_RUNTIME=production`이면 `production=True`인 모델만 통과.

### 1-3. 신규 모델 추가 절차

1. License 검증 — vendor 공식 문서 확인
2. `MODEL_REGISTRY` (Python) + `MODEL_POLICIES` (TS) 동시 추가
3. PoC에서 `eval-image-generation.ts` harness로 평가
4. PoC 통과 시 `production=True` 승급

## 2. 데이터 정책 (LoRA 학습 데이터)

### 2-1. 허용 source

| Source | 설명 | 학습 자격 |
|---|---|---|
| `owned` | 직접 촬영/제작 | ✅ |
| `partner` | 파트너/고객 명시 동의 (계약 명시) | ✅ |
| `stock_paid` | 계약된 유료 스톡 (학습 허용 명문) | ✅ |
| `synthetic` | 자체 3D 렌더 / Blender / synthetic | ✅ |
| `public_dataset` | AI 학습+상업 사용 명시 허용 공공 데이터 | ✅ (라이선스 재확인) |

### 2-2. 금지 source (training 진입 X)

| Source | 이유 |
|---|---|
| `external` | Pinterest, Instagram, 블로그, 출처만 표기, 자재 카탈로그 (학습 허용 불명확) |
| `unknown` | 미확인 — 가이드 §8-2 명시 금지 |

### 2-3. 필수 메타데이터 (ledger)

각 entry는 다음을 모두 가져야 함:

```jsonc
{
  "fileHash": "<sha256>",
  "filePath": "data/inpick-style-raw/owned/living-001.jpg",
  "source": "owned",                      // enum (위 표)
  "license": "Direct Capture (InPick)",   // 명시
  "rightsHolder": "InPick",               // 누가 권리 보유?
  "sourceRef": "contracts/...pdf",        // 계약 문서 ref (있으면)
  "allowsCommercialUse": true,            // ✅ 상업 사용 명시 허용
  "allowsModelTraining": true,            // ✅ 학습 사용 명시 허용
  "caption": "korean apartment living...", // LoRA tags
  "meta": {
    "roomType": "거실",
    "material": "white wall + oak floor",
    "lighting": "natural daylight",
    "style": "Korean apartment minimal",
    "furnitureDensity": "low"
  },
  "verification": "verified",
  "verifiedBy": "kim.sb",
  "verifiedAt": "2026-05-10T..."
}
```

### 2-4. 자격 통과 4 조건 (curate-inpick-style-dataset.ts)

다음을 **모두** 만족해야 training set 진입:

1. `allowsCommercialUse = true`
2. `allowsModelTraining = true`
3. `source ∈ {owned, partner, stock_paid, synthetic, public_dataset}`
4. `verification = "verified"`
5. `caption` 비어있지 않음 (≥ 10자)

### 2-5. Caption 가이드

가이드 §8 — caption에 다음 차원이 들어가야 LoRA가 스타일을 학습 가능:

- **roomType**: "거실 / 안방 / 주방 / 욕실 / 현관 / 드레스룸 / 발코니 / 다용도실"
- **material**: 벽지/페인트/마감재 키워드 ("white wall", "warm oak floor", "dark stone counter")
- **lighting**: "natural daylight", "warm lamp", "mixed", "morning sunlight from south"
- **style**: "Korean apartment", "minimal", "modern", "classic", "warm wood"
- **furniture density**: "low / medium / high" (가구 양)
- **선택**: 색상, 패브릭, 가구 종류 (소파, 다이닝, 침대 위치)

좋은 caption 예시:
> "korean apartment living room, white walls, warm oak floor, large south-facing window, low furniture density, natural daylight, beige sofa, minimal decoration"

피하기:
> "modern living room" (구체성 부족)
> "Pinterest style minimal" (외부 출처 언급)

## 3. LoRA 학습 전 체크리스트

학습 시작 전 다음을 모두 통과해야 함:

- [ ] **Phase 7 평가 통과**: `geometry_proxy.geometry_score >= flat_canny.geometry_score + 0.5` (proxy가 baseline 이상 효과)
  - 미달 시: LoRA 가치 없음. proxy_room.py 개선 우선.
- [ ] **N ≥ 200** training 자격 통과 이미지 (스타일 다양성 확보 권장)
- [ ] **N ≥ 20** validation 자격 통과 이미지
- [ ] **roomType 분포 확인**: 거실/안방/주방 최소 30+ 각각, 기타 10+
- [ ] **lighting 분포**: natural / warm 각각 충분히
- [ ] **furnitureDensity 균형**: low/medium/high 모두 포함
- [ ] **license-ledger.jsonl 사람 검증 완료** (`verification=verified`만 export)
- [ ] **MANIFEST.jsonl 검토**: source / rightsHolder / allowsModelTraining 100% 채워짐
- [ ] **외부(external) / unknown 0건** export 확인
- [ ] **저장된 MANIFEST.jsonl 백업** (audit log)

## 4. 학습 후 체크리스트

LoRA 학습 완료 후 production 진입 전:

- [ ] `eval-image-generation.ts`에 `geometry_proxy_lora` 모드 추가 평가
- [ ] `geometry_proxy_lora.style_score >= geometry_proxy.style_score + 0.5` 만족
- [ ] LoRA가 **구조를 망가뜨리지 않음** 확인 (geometry/openings score 유지)
- [ ] LoRA artifact의 license 메타 (학습 데이터 → LoRA 파일) 동봉
- [ ] RunPod inpick-renderer에 mount 후 inference 테스트 (cold start + warm)

## 5. 사용

### 5-1. 데이터 수집

```bash
# 1. 원본 이미지를 source별로 분류
mkdir -p data/inpick-style-raw/{owned,partner,stock_paid,synthetic,public_dataset}
# (각 디렉토리에 이미지 복사/이동)

# 2. ledger 신규 작성 (스캔 — source=unknown으로 시작)
npx tsx scripts/create-data-license-ledger.ts \
  --scan data/inpick-style-raw \
  --out data/inpick-style/license-ledger.jsonl

# 3. 사람이 ledger 열어서 source/license/allows*/caption/meta 채움
#    + verification: pending → verified | rejected

# 4. 통계 확인
npx tsx scripts/create-data-license-ledger.ts \
  --stats data/inpick-style/license-ledger.jsonl

# 5. 자격 통과 항목만 export
npx tsx scripts/curate-inpick-style-dataset.ts \
  --ledger data/inpick-style/license-ledger.jsonl \
  --out   data/inpick-style \
  --validationRatio 0.1
```

### 5-2. 결과 구조

```
data/inpick-style/
├── license-ledger.jsonl         # 모든 후보 (verified + rejected + pending)
├── train/
│   ├── 1a2b3c4d5e6f7890.jpg
│   ├── 1a2b3c4d5e6f7890.txt    # caption
│   └── ...
├── validation/
│   └── ...
└── MANIFEST.jsonl               # 학습 매핑 + license 메타 (audit)
```

### 5-3. LoRA 학습 (가이드 외 — 별도 toolkit)

- `kohya_ss` / `diffusers` example / `simple-tuner` 등 사용
- base model: FLUX.2-klein-4b (production), FLUX.1-dev (PoC만)
- LoRA rank: 8~16 (스타일 LoRA 권장)
- 학습률: 1e-4 ~ 5e-5
- epoch: 10~30 (early stopping)
- validation으로 overfitting 모니터링

## 6. 변경 금지

- 가이드 §8-2 인용:
  - ❌ Pinterest 크롤링 이미지
  - ❌ 인스타/블로그/커뮤니티 이미지
  - ❌ 출처만 표기한 외부 이미지
  - ❌ 학습 허용 범위가 불명확한 자재 카탈로그
- ❌ unknown / external을 어떻게든 training에 포함시키는 코드 추가 금지
- ❌ "이 정도면 괜찮을 듯" 으로 verified 표시 금지 (실제 라이선스 문서 필수)
- ❌ LoRA로 도면-렌더 페어 학습 시도 금지 (구조는 geometry pipeline)

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-10 | Phase 8 초기 — 정책 + ledger 스키마 + curate 스크립트 |
