import type {
  RenderItem,
  Step2Data,
} from "@/components/workflow/Step2Designer";
import type { DesignOutput } from "@/lib/inpick/estimate-context/types";
import type { SanitizedLockedAsset } from "@/lib/inpick/locked-design/contracts";

const ROOM_KEY_MAP: Record<string, string> = {
  거실: "living",
  안방: "master",
  주방: "kitchen",
  부엌: "kitchen",
  욕실1: "bath",
  욕실: "bath",
  침실1: "bedroom",
  침실: "bedroom",
  현관: "entrance",
  발코니: "balcony",
  드레스룸: "dress",
};

function lockedAssetIdFromImageUrl(imageUrl: string): string | null {
  return imageUrl.startsWith("locked-design:")
    ? imageUrl.slice("locked-design:".length)
    : null;
}

function restoreLockedRender(
  render: RenderItem,
  asset: SanitizedLockedAsset,
): RenderItem {
  const canDisplay = asset.unlocked && Boolean(asset.viewUrl);
  return {
    ...render,
    url: canDisplay ? asset.viewUrl! : "",
    lockedAssetId: asset.id,
    accessState: canDisplay ? "unlocked" : "locked",
    entitlementGranted: asset.unlocked,
    viewExpiresAt: asset.viewExpiresAt,
  };
}

/**
 * workflow_state의 경량 스냅샷과 design_outputs/locked grant를 합친다.
 *
 * 잠금 원본 URL은 스냅샷에 저장하지 않고, 이미 결제한 자산만 서버가 다시
 * 서명한 URL로 복구한다. `locked-design:<id>` 마커를 일반 공개 URL로 취급하지 않는다.
 */
export function mergeRestoredDesigns(
  step2: Step2Data,
  outputs: DesignOutput[],
  lockedAssets: SanitizedLockedAsset[],
): Step2Data {
  if (outputs.length === 0 && lockedAssets.length === 0) return step2;

  const assetById = new Map(lockedAssets.map((asset) => [asset.id, asset]));
  const assetByOutputId = new Map(
    lockedAssets.map((asset) => [asset.designOutputId, asset]),
  );
  const next: Step2Data = {
    ...step2,
    selectedByRoom: { ...(step2.selectedByRoom || {}) },
    rendersByRoom: { ...(step2.rendersByRoom || {}) },
    finalSelectedImageUrlsByRoom: {
      ...(step2.finalSelectedImageUrlsByRoom || {}),
    },
  };
  let changed = false;

  // 경량 스냅샷에 남은 lockedAssetId를 영구 grant와 먼저 결합한다.
  for (const [roomKey, roomRenders] of Object.entries(next.rendersByRoom)) {
    let roomChanged = false;
    const restored = roomRenders.map((render) => {
      if (!render.lockedAssetId) return render;
      const asset = assetById.get(render.lockedAssetId);
      if (!asset) return render;
      roomChanged = true;
      return restoreLockedRender(render, asset);
    });
    if (roomChanged) {
      next.rendersByRoom[roomKey] = restored;
      changed = true;
    }
  }

  for (const output of outputs) {
    if (!output.imageUrl) continue;
    const roomKey = ROOM_KEY_MAP[output.targetName] || output.targetId || "living";
    const existing = next.rendersByRoom[roomKey] || [];
    const markerAssetId = lockedAssetIdFromImageUrl(output.imageUrl);
    const lockedAsset =
      assetByOutputId.get(output.id) ||
      (markerAssetId ? assetById.get(markerAssetId) : undefined);

    if (markerAssetId || lockedAsset) {
      const assetId = lockedAsset?.id || markerAssetId!;
      const existingIndex = existing.findIndex(
        (render) => render.lockedAssetId === assetId,
      );
      if (existingIndex >= 0) {
        if (lockedAsset) {
          const restored = [...existing];
          restored[existingIndex] = restoreLockedRender(
            restored[existingIndex],
            lockedAsset,
          );
          next.rendersByRoom[roomKey] = restored;
          changed = true;
        }
        continue;
      }

      const lockedRender: RenderItem = {
        url: "",
        lockedAssetId: assetId,
        accessState:
          lockedAsset?.unlocked && lockedAsset.viewUrl ? "unlocked" : "locked",
        entitlementGranted: lockedAsset?.unlocked ?? false,
        viewExpiresAt: lockedAsset?.viewExpiresAt,
        prompt: output.prompt || "",
        costUsd: 0,
        timestamp: output.createdAt || lockedAsset?.createdAt || new Date().toISOString(),
      };
      next.rendersByRoom[roomKey] = [
        ...existing.filter(
          (render) =>
            !render.url?.startsWith("[base64") &&
            !render.refinedUrl?.startsWith("[base64"),
        ),
        lockedAsset ? restoreLockedRender(lockedRender, lockedAsset) : lockedRender,
      ];
      if (next.selectedByRoom[roomKey] == null) {
        next.selectedByRoom[roomKey] = next.rendersByRoom[roomKey].length - 1;
      }
      changed = true;
      continue;
    }

    const publicExistingIndex = existing.findIndex(
      (render) =>
        render.url === output.imageUrl || render.refinedUrl === output.imageUrl,
    );
    if (publicExistingIndex >= 0) {
      const matchedRender = existing[publicExistingIndex];
      if (
        matchedRender.accessState !== "free" ||
        matchedRender.entitlementGranted !== true
      ) {
        const normalized = [...existing];
        normalized[publicExistingIndex] = {
          ...matchedRender,
          accessState: "free",
          entitlementGranted: true,
        };
        next.rendersByRoom[roomKey] = normalized;
        changed = true;
      }
      continue;
    }
    const cleaned = existing.filter(
      (render) =>
        !render.url?.startsWith("[base64") &&
        !render.refinedUrl?.startsWith("[base64"),
    );
    cleaned.push({
      url: output.imageUrl,
      prompt: output.prompt || "",
      costUsd: 0,
      timestamp: output.createdAt || new Date().toISOString(),
      // locked-design 마커가 아닌 공개 design_output은 이미 생성·지급된 결과다.
      // 명시적인 free 상태가 없으면 비거실 2차 시안이 최종 선택창에서 걸러진다.
      accessState: "free",
      entitlementGranted: true,
    });
    next.rendersByRoom[roomKey] = cleaned;
    if (next.selectedByRoom[roomKey] == null) {
      next.selectedByRoom[roomKey] = cleaned.length - 1;
    }
    changed = true;
  }

  // 최종 선택 당시 저장된 signed URL은 만료될 수 있다. 선택 인덱스가 가리키는
  // 결제 완료 자산의 새 URL로 바꿔 Step3/PDF가 오래된 주소를 우선하지 않게 한다.
  for (const roomKey of Object.keys(next.finalSelectedImageUrlsByRoom || {})) {
    const selectedIndex = next.selectedByRoom[roomKey];
    const selectedRender =
      selectedIndex != null ? next.rendersByRoom[roomKey]?.[selectedIndex] : undefined;
    const restoredUrl = selectedRender?.refinedUrl || selectedRender?.url;
    if (
      restoredUrl &&
      selectedRender?.accessState !== "locked" &&
      next.finalSelectedImageUrlsByRoom?.[roomKey] !== restoredUrl
    ) {
      next.finalSelectedImageUrlsByRoom![roomKey] = restoredUrl;
      changed = true;
    }
  }

  return changed ? next : step2;
}
