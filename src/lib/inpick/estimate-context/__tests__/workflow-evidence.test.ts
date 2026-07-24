import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkflowEstimateEvidence } from "../workflow-evidence";

test("serializes only final room images with their exact prompts and selected products", () => {
  const evidence = buildWorkflowEstimateEvidence(
    {
      selectedByRoom: { living: 0, bath: 1 },
      finalSelectedImageUrlsByRoom: {
        bath: "https://img/bath-final.png",
      },
      conceptPrompt: "따뜻한 모던 콘셉트",
      promptByRoom: { bath: "욕실 벽은 대형 타일" },
      rendersByRoom: {
        living: [{ url: "https://img/living.png", prompt: "거실" }],
        bath: [
          { url: "https://img/bath-old.png", prompt: "이전 욕실" },
          {
            url: "https://img/bath-source.png",
            refinedUrl: "https://img/bath-final.png",
            prompt: "포세린 타일",
            revisedPrompt: "욕실 바닥 포세린 타일, 벽 타일",
          },
        ],
      },
      materialSelections: {
        "bath::toilet": {
          roomId: "bath",
          roomName: "욕실",
          surfaceType: "unknown",
          materialCategory: "room-product.toilet",
          materialProductId: "product-toilet",
          materialNameKo: "양변기",
          confidence: 1,
          partCode: "toilet",
        },
        "living::floor": {
          roomId: "living",
          roomName: "거실",
          surfaceType: "floor",
          materialCategory: "engineered_floor",
          materialProductId: "product-floor",
          confidence: 1,
        },
      },
    },
    (roomId) => ({ bath: "욕실", living: "거실" })[roomId] || roomId,
  );

  assert.equal(evidence.selectedDesigns.length, 1);
  assert.equal(evidence.selectedDesigns[0].targetId, "bath");
  assert.equal(evidence.selectedDesigns[0].imageUrl, "https://img/bath-final.png");
  assert.match(evidence.selectedDesigns[0].prompt || "", /욕실 바닥 포세린 타일/);
  assert.match(evidence.selectedDesigns[0].prompt || "", /따뜻한 모던 콘셉트/);
  assert.deepEqual(evidence.selectedImageUrls, ["https://img/bath-final.png"]);
  assert.deepEqual(
    evidence.userMaterialEdits.map((edit) => edit.id),
    ["bath::toilet"],
  );
  assert.equal(evidence.userMaterialEdits[0].surfaceType, "fixture");
});

test("uses a freshly restored selected render when the saved final URL expired", () => {
  const evidence = buildWorkflowEstimateEvidence({
    selectedByRoom: { bath: 0 },
    finalSelectedImageUrlsByRoom: {
      bath: "https://signed.example/expired.webp",
    },
    rendersByRoom: {
      bath: [
        {
          url: "https://signed.example/fresh.webp",
          prompt: "욕실",
        },
      ],
    },
  });

  assert.equal(
    evidence.selectedDesigns[0].imageUrl,
    "https://signed.example/fresh.webp",
  );
});
