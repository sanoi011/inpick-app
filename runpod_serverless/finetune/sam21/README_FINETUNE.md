# SAM 2.1 + LoRA fine-tune — InPick 인테리어 세그멘테이션

> 베이스: Meta SAM 2.1 (hiera_large) → 인테리어 16 카테고리 (floor/wall/ceiling/window/door/curtain/sink/counter/tile/cabinet/wardrobe/bathtub/toilet/table/lamp/fireplace) 정밀도 향상.
> 데이터: ADE20K 35K장 (15 클래스 매핑) + InPick 자체 라벨링 (추후 추가).
> 학습 시간/비용: H100 80GB × 12시간 ≈ ₩4~5만원 (RunPod 시간당 ~₩4,000).

---

## 1. 사전 준비 (1회)

### 1-1. ADE20K 데이터셋 다운로드
```bash
# 약 1GB
wget http://data.csail.mit.edu/places/ADEchallenge/ADEChallengeData2016.zip
unzip ADEChallengeData2016.zip -d E:/InPick/data/datasets/ade20k/
```

### 1-2. SAM 2.1 base checkpoint 다운로드
```bash
# 학습 컨테이너 안에서 또는 사전 다운로드 후 마운트
mkdir -p ./checkpoints
wget https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt \
     -O ./checkpoints/sam2.1_hiera_large.pt
```

### 1-3. 학습 데이터 변환 (1회)
```bash
cd E:/InPick/inpick-app/runpod_serverless/finetune/sam21
python prepare_dataset.py \
  --ade-root E:/InPick/data/datasets/ade20k/ADEChallengeData2016 \
  --out-dir ./prepared \
  --max-samples-per-class 2000
```

출력:
- `prepared/train.jsonl` (~30K 샘플)
- `prepared/val.jsonl` (~3K 샘플)
- `prepared/masks/<hash>.png` (binary GT mask)

### 1-4. (선택) WandB 셋업
```bash
pip install wandb
wandb login   # API 키 입력
```

---

## 2. 로컬 학습 (개발/디버깅용)

```bash
cd runpod_serverless/finetune/sam21
pip install -r requirements.txt

# config.yaml의 ade_root + checkpoint 경로 로컬에 맞게 수정
# train.ade_root: E:/InPick/data/datasets/ade20k/ADEChallengeData2016
# model.checkpoint: ./checkpoints/sam2.1_hiera_large.pt

python train_sam_lora.py --config config.yaml             # WandB 비활성
python train_sam_lora.py --config config.yaml --wandb     # WandB 로깅
```

⚠️ 로컬 GPU가 RTX 3090 (24GB) 이하면 batch_size=1, gradient_checkpointing=true, hiera_base_plus 또는 hiera_small 사용 권장.

---

## 3. RunPod 학습 (프로덕션)

### 3-1. 컨테이너 빌드 + 푸시
```bash
docker build -f Dockerfile.train -t USERNAME/inpick-sam21-train:v1 .
docker push USERNAME/inpick-sam21-train:v1
```

### 3-2. RunPod GPU Pod 생성
- **GPU**: H100 80GB (권장) 또는 A100 80GB
- **컨테이너**: `USERNAME/inpick-sam21-train:v1`
- **Volume 마운트**:
  - `/app/checkpoints` → SAM 2.1 base checkpoint 저장 (1회)
  - `/app/datasets` → ADE20K (또는 prepare 후 prepared/ 만 마운트)
  - `/app/prepared` → 변환된 학습 데이터
  - `/app/outputs` → 학습 결과 (영속 보관)

### 3-3. 실행
```bash
# Pod SSH 접속 후
cd /app
python prepare_dataset.py \
  --ade-root /app/datasets/ade20k/ADEChallengeData2016 \
  --out-dir /app/prepared

python train_sam_lora.py --config config.yaml --wandb
```

### 3-4. 결과
- `outputs/best/` — 검증 IoU 최고 시점 어댑터
- `outputs/checkpoint-*/` — 주기적 어댑터
- `outputs/final/` — 마지막 학습 어댑터

각 폴더 구조:
```
outputs/best/
├── adapter_config.json
├── adapter_model.safetensors    # ~10~50MB (LoRA만)
└── training_meta.json           # step, metrics, lora_rank 등
```

---

## 4. Inference 서버 적용

### 4-1. 어댑터를 inference 컨테이너에 배포
- `outputs/best/`를 `/app/checkpoints/lora-adapter/` 경로로 RunPod Serverless inference Volume에 복사
- 또는 GitHub Actions로 자동 빌드/배포 (handler.py가 부팅 시 자동 로드)

### 4-2. handler.py 환경변수
```bash
# RunPod Serverless 환경변수 또는 Dockerfile ENV
INPICK_LORA_ADAPTER_PATH=/app/checkpoints/lora-adapter
```

이 변수가 설정되어 있으면 `handler.py`가 부팅 시 LoRA 어댑터 자동 로드 → 인테리어 카테고리 mask 정확도 향상.
미설정 시 base SAM 2.1 그대로 사용 (호환).

---

## 5. 하이퍼파라미터 튜닝 가이드

### 5-1. LoRA rank
- `rank: 8` — 베이스 모델 변형 최소, VRAM 적음, 작은 fine-tune
- `rank: 16` (기본) — 균형, 권장
- `rank: 32` — capacity↑, VRAM↑, 대규모 데이터셋용

### 5-2. Batch size + grad accumulation
- H100 80GB: batch_size=4, grad_accum=4 → effective 16
- A100 80GB: batch_size=2, grad_accum=8 → effective 16
- RTX 4090 24GB: batch_size=1, grad_accum=16 → effective 16 (느림)

### 5-3. 학습률
- LoRA는 보통 base 모델보다 높은 LR 가능
- 1e-4 (기본) → val_loss 발산 시 5e-5로 낮춤
- val_iou 정체 시 1e-3로 높여서 재시도

### 5-4. 학습 종료 조건
- val_iou 0.7 이상 시 충분 (base SAM 2.1은 0.6 수준)
- val_iou 정체 + epoch 3 도달 시 종료
- 최종 IoU < 0.5면 데이터셋 또는 LoRA target_modules 재검토

---

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| OOM (CUDA out of memory) | VRAM 부족 | `gradient_checkpointing: true` + `precision: bf16` + batch_size↓ |
| `ModuleNotFoundError: sam2` | sam2 패키지 미설치 | `pip install git+https://github.com/facebookresearch/sam2.git` |
| LoRA target_modules not found | SAM 2.1 모듈 경로 오인 | `train_sam_lora.py`에서 `model.named_modules()` 출력하여 실제 경로 확인 |
| val_iou=0 만 출력 | mask 정규화 오류 | GT mask가 0/255가 아닌지 확인 (prepare_dataset.py에서 255 사용) |
| training loss = NaN | bf16 사용 + 큰 LR | precision: fp32로 변경하거나 LR 낮춤 |

---

## 7. 파일 인벤토리

| 파일 | 용도 |
|------|------|
| `inpick_to_ade20k_mapping.json` | ADE20K 150 → 인픽 16 카테고리 매핑 |
| `prepare_dataset.py` | ADE20K → 학습 JSONL + binary mask 변환 |
| `train_sam_lora.py` | SAM 2.1 + LoRA fine-tune 학습 루프 |
| `config.yaml` | 하이퍼파라미터 (LoRA rank, LR, batch, epochs 등) |
| `requirements.txt` | Python 의존성 |
| `Dockerfile.train` | RunPod 학습 컨테이너 |
| `outputs/best/adapter_model.safetensors` | (학습 완료 후) 추론용 LoRA 어댑터 |
