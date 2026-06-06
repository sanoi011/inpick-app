"""
SAM 2.1 + LoRA fine-tune for InPick interior segmentation.

가이드: README_FINETUNE.md
설정: config.yaml

흐름:
  1. SAM 2.1 base 로드 (image_encoder + prompt_encoder + mask_decoder)
  2. image_encoder + prompt_encoder freeze
  3. mask_decoder의 attention q/v projections에 LoRA injection
  4. JSONL train/val 데이터셋 (prepare_dataset.py 출력) 로드
  5. click prompt → predict mask → BCE+Dice loss → backward
  6. val IoU 최고 시점 체크포인트 저장 + LoRA 어댑터 export

실행:
  python train_sam_lora.py --config config.yaml
  python train_sam_lora.py --config config.yaml --wandb     # WandB 로깅
  python train_sam_lora.py --config config.yaml --resume outputs/checkpoint-3000.pt
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import yaml
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

# SAM 2 — 컨테이너에 미리 설치되어 있어야 함
from sam2.build_sam import build_sam2

# PEFT
from peft import LoraConfig, get_peft_model


# ════════════════════════════════════════════════════════════════════════════
# 데이터셋
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class TrainSample:
    image_path: str
    mask_path: str
    click_xy: tuple[int, int]
    label: int
    inpick_category: str


class SamFineTuneDataset(Dataset):
    """JSONL → (image, point, GT mask) 샘플."""

    def __init__(
        self,
        jsonl_path: Path,
        image_root: Path,
        mask_root: Path,
        image_size: int = 1024,
    ):
        self.image_root = image_root
        self.mask_root = mask_root
        self.image_size = image_size
        with open(jsonl_path, "r", encoding="utf-8") as f:
            self.samples = [json.loads(line) for line in f if line.strip()]
        if not self.samples:
            raise RuntimeError(f"No samples in {jsonl_path}")
        print(f"[dataset] {jsonl_path.name}: {len(self.samples)} samples")

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        s = self.samples[idx]
        # 이미지
        img_path = self.image_root / s["image_path"]
        if not img_path.exists():
            # ade-root 기준 fallback
            img_path = self.image_root.parent / s["image_path"]
        img = Image.open(img_path).convert("RGB")
        orig_w, orig_h = img.size

        # GT mask (binary)
        mask_path = self.mask_root / s["mask_path"]
        mask = Image.open(mask_path).convert("L")
        if mask.size != (orig_w, orig_h):
            mask = mask.resize((orig_w, orig_h), Image.NEAREST)

        # 1024×1024 resize
        img_resized = img.resize((self.image_size, self.image_size), Image.BILINEAR)
        mask_resized = mask.resize((self.image_size, self.image_size), Image.NEAREST)

        # to tensor
        img_arr = np.array(img_resized, dtype=np.float32) / 255.0  # [H,W,3]
        img_tensor = torch.from_numpy(img_arr).permute(2, 0, 1)  # [3,H,W]
        # SAM normalization (Meta's stats)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        img_tensor = (img_tensor - mean) / std

        mask_arr = np.array(mask_resized, dtype=np.float32) / 255.0  # [H,W]
        mask_tensor = torch.from_numpy(mask_arr).unsqueeze(0)  # [1,H,W]

        # click 좌표를 1024 스케일로 변환
        click_x, click_y = s["click_xy"]
        click_x_resized = click_x * self.image_size / orig_w
        click_y_resized = click_y * self.image_size / orig_h

        return {
            "image": img_tensor,
            "mask": mask_tensor,
            "point_coords": torch.tensor([[click_x_resized, click_y_resized]], dtype=torch.float32),
            "point_labels": torch.tensor([s["label"]], dtype=torch.float32),
            "category": s["inpick_category"],
        }


def collate_fn(batch: list[dict[str, Any]]) -> dict[str, torch.Tensor]:
    return {
        "images": torch.stack([b["image"] for b in batch]),
        "masks": torch.stack([b["mask"] for b in batch]),
        "point_coords": torch.stack([b["point_coords"] for b in batch]),
        "point_labels": torch.stack([b["point_labels"] for b in batch]),
        "categories": [b["category"] for b in batch],
    }


# ════════════════════════════════════════════════════════════════════════════
# 손실
# ════════════════════════════════════════════════════════════════════════════
def dice_loss(pred: torch.Tensor, target: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    """Soft Dice loss. pred/target: [B,1,H,W] in [0,1]."""
    pred = pred.flatten(1)
    target = target.flatten(1)
    intersection = (pred * target).sum(1)
    union = pred.sum(1) + target.sum(1)
    dice = (2 * intersection + eps) / (union + eps)
    return 1 - dice.mean()


def compute_iou(pred: torch.Tensor, target: torch.Tensor, threshold: float = 0.5) -> float:
    """Binary IoU. pred/target: [B,1,H,W]."""
    pred_bin = (pred > threshold).float()
    target_bin = (target > threshold).float()
    intersection = (pred_bin * target_bin).sum((1, 2, 3))
    union = pred_bin.sum((1, 2, 3)) + target_bin.sum((1, 2, 3)) - intersection
    iou = (intersection / (union + 1e-6)).mean().item()
    return iou


# ════════════════════════════════════════════════════════════════════════════
# 학습 루프
# ════════════════════════════════════════════════════════════════════════════
def setup_lora(sam2_model: nn.Module, cfg: dict) -> nn.Module:
    """SAM 2.1에 LoRA 어댑터 주입. image_encoder + prompt_encoder freeze."""
    lora_cfg = cfg["lora"]

    # freeze image_encoder + prompt_encoder
    if lora_cfg.get("freeze_image_encoder", True):
        for p in sam2_model.image_encoder.parameters():
            p.requires_grad = False
    if lora_cfg.get("freeze_prompt_encoder", True):
        for p in sam2_model.sam_prompt_encoder.parameters():
            p.requires_grad = False

    # mask_decoder는 학습 (LoRA + 일부 head)
    peft_config = LoraConfig(
        r=lora_cfg["rank"],
        lora_alpha=lora_cfg["alpha"],
        lora_dropout=lora_cfg["dropout"],
        target_modules=lora_cfg["target_modules"],
        bias="none",
        task_type=None,
    )

    # LoRA는 mask_decoder 모듈에만 적용
    sam2_model.sam_mask_decoder = get_peft_model(sam2_model.sam_mask_decoder, peft_config)

    # 학습 가능 파라미터 통계
    total = sum(p.numel() for p in sam2_model.parameters())
    trainable = sum(p.numel() for p in sam2_model.parameters() if p.requires_grad)
    print(f"[LoRA] total params: {total/1e6:.1f}M, trainable: {trainable/1e6:.2f}M ({100*trainable/total:.2f}%)")
    return sam2_model


def forward_step(
    model: nn.Module,
    batch: dict[str, torch.Tensor],
    device: torch.device,
    image_size: int,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """SAM 2.1 forward — image_encoder → prompt_encoder → mask_decoder → mask logits.

    Returns:
        loss, pred_masks (sigmoid), gt_masks
    """
    images = batch["images"].to(device, non_blocking=True)              # [B,3,H,W]
    gt_masks = batch["masks"].to(device, non_blocking=True)             # [B,1,H,W]
    point_coords = batch["point_coords"].to(device, non_blocking=True)  # [B,1,2]
    point_labels = batch["point_labels"].to(device, non_blocking=True)  # [B,1]

    # image embeddings (frozen)
    with torch.no_grad():
        backbone_out = model.image_encoder(images)
        image_embeddings = backbone_out["vision_features"]
        high_res_feats = backbone_out.get("backbone_fpn", None)

    # prompt embeddings
    sparse_embeddings, dense_embeddings = model.sam_prompt_encoder(
        points=(point_coords, point_labels),
        boxes=None,
        masks=None,
    )

    # mask decoder forward
    low_res_masks, iou_predictions, _, _ = model.sam_mask_decoder(
        image_embeddings=image_embeddings,
        image_pe=model.sam_prompt_encoder.get_dense_pe(),
        sparse_prompt_embeddings=sparse_embeddings,
        dense_prompt_embeddings=dense_embeddings,
        multimask_output=False,                                          # 학습은 single mask
        repeat_image=False,
        high_res_features=high_res_feats,
    )

    # upsample to image size
    pred_masks = F.interpolate(
        low_res_masks, size=(image_size, image_size), mode="bilinear", align_corners=False,
    )
    pred_sigmoid = torch.sigmoid(pred_masks)

    # 손실 (BCE + Dice)
    bce = F.binary_cross_entropy_with_logits(pred_masks, gt_masks)
    dice = dice_loss(pred_sigmoid, gt_masks)
    loss = bce + dice
    return loss, pred_sigmoid.detach(), gt_masks


def evaluate(
    model: nn.Module, val_loader: DataLoader, device: torch.device, image_size: int,
) -> dict[str, float]:
    model.eval()
    losses = []
    ious = []
    with torch.no_grad():
        for batch in tqdm(val_loader, desc="[eval]", leave=False):
            loss, pred_sig, gt = forward_step(model, batch, device, image_size)
            losses.append(loss.item())
            ious.append(compute_iou(pred_sig, gt))
    model.train()
    return {
        "val_loss": float(np.mean(losses)) if losses else 0.0,
        "val_iou": float(np.mean(ious)) if ious else 0.0,
    }


def train(cfg: dict, args: argparse.Namespace) -> None:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cpu":
        print("WARNING: GPU 없음 — CPU 학습은 매우 느림.")

    # 데이터셋
    data_root = Path(cfg["train"]["data_root"])
    ade_root = Path(cfg["train"]["ade_root"]).parent  # ADE20K 부모 (image_path가 ade20k/...로 시작)
    image_size = 1024

    train_ds = SamFineTuneDataset(
        data_root / "train.jsonl", ade_root, data_root, image_size=image_size,
    )
    val_ds = SamFineTuneDataset(
        data_root / "val.jsonl", ade_root, data_root, image_size=image_size,
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=cfg["train"]["batch_size"],
        shuffle=True,
        num_workers=cfg["train"]["num_workers"],
        collate_fn=collate_fn,
        pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=cfg["eval"]["batch_size"],
        shuffle=False,
        num_workers=cfg["train"]["num_workers"],
        collate_fn=collate_fn,
        pin_memory=True,
    )

    # 모델
    print(f"[model] loading SAM 2.1 from {cfg['model']['checkpoint']}")
    sam2_model = build_sam2(cfg["model"]["config"], cfg["model"]["checkpoint"], device=device)
    sam2_model = setup_lora(sam2_model, cfg)
    sam2_model.to(device)
    sam2_model.train()

    if cfg["train"].get("gradient_checkpointing"):
        sam2_model.image_encoder.gradient_checkpointing_enable() if hasattr(
            sam2_model.image_encoder, "gradient_checkpointing_enable"
        ) else None

    # 옵티마이저
    trainable_params = [p for p in sam2_model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(
        trainable_params,
        lr=cfg["train"]["lr"],
        weight_decay=cfg["train"]["weight_decay"],
    )

    # LR scheduler (linear warmup + cosine)
    total_steps = len(train_loader) * cfg["train"]["epochs"] // cfg["train"]["grad_accum_steps"]
    warmup_steps = cfg["train"]["warmup_steps"]

    def lr_lambda(step: int) -> float:
        if step < warmup_steps:
            return step / max(1, warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1 + math.cos(math.pi * progress))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

    # mixed precision
    precision = cfg["train"].get("precision", "bf16")
    if precision == "bf16" and torch.cuda.is_bf16_supported():
        amp_dtype = torch.bfloat16
    elif precision == "fp16":
        amp_dtype = torch.float16
    else:
        amp_dtype = torch.float32
    use_amp = amp_dtype != torch.float32
    scaler = torch.amp.GradScaler("cuda") if amp_dtype == torch.float16 else None

    # WandB
    use_wandb = args.wandb or cfg["log"].get("use_wandb", False)
    wandb = None
    if use_wandb:
        try:
            import wandb as _wandb
            _wandb.init(
                project=cfg["log"]["wandb_project"],
                name=cfg["log"].get("wandb_run_name"),
                config=cfg,
            )
            wandb = _wandb
        except Exception as e:
            print(f"[wandb] init failed: {e} — disabled")
            use_wandb = False

    # 체크포인트 폴더
    out_dir = Path(cfg["output"]["dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    # 학습
    global_step = 0
    best_iou = 0.0
    grad_accum = cfg["train"]["grad_accum_steps"]
    print_every = cfg["log"].get("print_every", 50)

    print(f"[train] start — total_steps={total_steps}, batch={cfg['train']['batch_size']}, "
          f"effective_batch={cfg['train']['batch_size']*grad_accum}, lr={cfg['train']['lr']}, "
          f"epochs={cfg['train']['epochs']}, precision={precision}")

    optimizer.zero_grad(set_to_none=True)
    t0 = time.time()
    for epoch in range(cfg["train"]["epochs"]):
        running_loss = 0.0
        for step, batch in enumerate(train_loader):
            with torch.amp.autocast("cuda", dtype=amp_dtype, enabled=use_amp):
                loss, _, _ = forward_step(sam2_model, batch, device, image_size)
                loss = loss / grad_accum

            if scaler is not None:
                scaler.scale(loss).backward()
            else:
                loss.backward()

            running_loss += loss.item() * grad_accum

            if (step + 1) % grad_accum == 0:
                if scaler is not None:
                    scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(trainable_params, cfg["train"]["max_grad_norm"])
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    torch.nn.utils.clip_grad_norm_(trainable_params, cfg["train"]["max_grad_norm"])
                    optimizer.step()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)
                global_step += 1

                if global_step % print_every == 0:
                    avg_loss = running_loss / print_every / grad_accum
                    elapsed = time.time() - t0
                    print(f"[step {global_step}/{total_steps}] loss={avg_loss:.4f} "
                          f"lr={scheduler.get_last_lr()[0]:.2e} elapsed={elapsed/60:.1f}min")
                    if use_wandb and wandb:
                        wandb.log({"train/loss": avg_loss, "train/lr": scheduler.get_last_lr()[0]}, step=global_step)
                    running_loss = 0.0

                # 평가
                if global_step % cfg["eval"]["every_n_steps"] == 0:
                    metrics = evaluate(sam2_model, val_loader, device, image_size)
                    print(f"[eval step={global_step}] val_loss={metrics['val_loss']:.4f} val_iou={metrics['val_iou']:.4f}")
                    if use_wandb and wandb:
                        wandb.log(metrics, step=global_step)
                    if cfg["eval"].get("save_best") and metrics["val_iou"] > best_iou:
                        best_iou = metrics["val_iou"]
                        save_lora_adapter(sam2_model, out_dir / "best", cfg, metrics, global_step)
                        print(f"  ↑ best val_iou: {best_iou:.4f} — saved to outputs/best")

                # 주기 체크포인트
                if global_step % cfg["output"]["save_every_n_steps"] == 0:
                    ckpt_dir = out_dir / f"checkpoint-{global_step}"
                    save_lora_adapter(sam2_model, ckpt_dir, cfg, {"step": global_step}, global_step)

        print(f"[epoch {epoch+1}/{cfg['train']['epochs']}] complete")

    # final eval + save
    metrics = evaluate(sam2_model, val_loader, device, image_size)
    print(f"[final] val_loss={metrics['val_loss']:.4f} val_iou={metrics['val_iou']:.4f}")
    save_lora_adapter(sam2_model, out_dir / "final", cfg, metrics, global_step)
    if use_wandb and wandb:
        wandb.log({"final/val_iou": metrics["val_iou"]})
        wandb.finish()
    print(f"[done] best_val_iou={best_iou:.4f}, total_time={(time.time()-t0)/3600:.2f}h")


def save_lora_adapter(
    model: nn.Module, out_dir: Path, cfg: dict, metrics: dict, step: int,
) -> None:
    """LoRA 어댑터만 저장 (베이스 모델 제외 — 작은 사이즈)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # PEFT model의 save_pretrained는 mask_decoder의 LoRA만 저장
    if hasattr(model.sam_mask_decoder, "save_pretrained"):
        model.sam_mask_decoder.save_pretrained(out_dir)
    # 메타정보
    meta = {
        "adapter_name": cfg["output"]["adapter_name"],
        "step": step,
        "metrics": metrics,
        "lora_rank": cfg["lora"]["rank"],
        "lora_alpha": cfg["lora"]["alpha"],
        "base_checkpoint": cfg["model"]["checkpoint"],
        "base_config": cfg["model"]["config"],
    }
    with open(out_dir / "training_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


# ════════════════════════════════════════════════════════════════════════════
# 진입점
# ════════════════════════════════════════════════════════════════════════════
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=Path, default=Path(__file__).parent / "config.yaml")
    ap.add_argument("--wandb", action="store_true", help="enable WandB logging")
    ap.add_argument("--no-wandb", action="store_true", help="force disable WandB")
    ap.add_argument("--resume", type=Path, default=None, help="checkpoint dir to resume from")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    # config 로드
    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    # seed
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    # --no-wandb override
    if args.no_wandb:
        cfg["log"]["use_wandb"] = False
        args.wandb = False

    train(cfg, args)


if __name__ == "__main__":
    main()
