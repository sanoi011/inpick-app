/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Crosshair,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import type { SamPolygonResult } from "@/hooks/useSamClient";
import {
  buildRoomProductPromptMarkdown,
  getRoomProductParts,
  type RoomCatalogProduct,
  type RoomProductCustomization,
  type RoomProductPartCode,
  type RoomProductPartDefinition,
  type RoomProductRegionSelection,
} from "@/lib/inpick/room-product-customization";
import type { SamSurfaceTarget } from "@/lib/inpick/sam-surface-prompts";

import ClickableRenderImage from "./ClickableRenderImage";

export interface RoomProductRegenerationRequest {
  partCode: RoomProductPartCode;
  targetSurface: SamSurfaceTarget;
  product: RoomCatalogProduct;
  region: RoomProductRegionSelection;
  promptMarkdown: string;
}

interface Props {
  imageUrl: string;
  value: RoomProductCustomization;
  onChange: (next: RoomProductCustomization) => void;
  searchCatalog: (
    partCode: RoomProductPartCode,
    query: string,
  ) => Promise<readonly RoomCatalogProduct[]>;
  onRegenerate: (request: RoomProductRegenerationRequest) => Promise<void>;
  onImageError?: () => void;
  disabled?: boolean;
  className?: string;
}

function selectedLabel(
  value: RoomProductCustomization,
  partCode: RoomProductPartCode,
): string {
  const product = value.selections[partCode]?.product;
  return product ? [product.brand, product.sku].filter(Boolean).join(" · ") : "SKU 선택";
}

function samTargetForPart(definition: RoomProductPartDefinition): SamSurfaceTarget {
  if (definition.partCode === "window_covering") return "curtain";
  if (definition.partCode === "main_lighting") return "lighting";
  switch (definition.targetSurface) {
    case "floor":
    case "wall":
    case "ceiling":
    case "window":
    case "door":
    case "tile_wall":
    case "cabinet":
    case "counter":
    case "fixture":
      return definition.targetSurface;
    default:
      return "fixture";
  }
}

function toSamSelection(
  region: RoomProductRegionSelection | undefined,
): SamPolygonResult | null {
  if (!region) return null;
  return {
    polygon: region.polygon,
    confidence: region.confidence,
    area_pixels: region.areaPixels,
    image_size: region.imageSize,
    mask_url: region.maskUrl || null,
    semantic_label: String(region.targetSurface),
  };
}

export default function RoomProductImageSelector({
  imageUrl,
  value,
  onChange,
  searchCatalog,
  onRegenerate,
  onImageError,
  disabled = false,
  className = "",
}: Props) {
  const definitions = getRoomProductParts(value.roomKind);
  const [activePart, setActivePart] = useState<RoomProductPartCode | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly RoomCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [imageRecovering, setImageRecovering] = useState(false);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    setImageRecovering(false);
  }, [imageUrl]);

  useEffect(() => {
    setActivePart(null);
    setResults([]);
    setError(null);
  }, [value.sourceRenderKey]);

  const activeDefinition = definitions.find((part) => part.partCode === activePart);
  const selectedDefinitions = definitions.filter((part) => value.selections[part.partCode]);
  const activeRegion = activePart ? value.regions?.[activePart] : undefined;
  const activeSelection = activePart ? value.selections[activePart] : undefined;
  const boundaryMatchesSource =
    Boolean(activeRegion) &&
    Boolean(value.sourceRenderKey) &&
    activeRegion?.sourceRenderKey === value.sourceRenderKey;

  const loadProducts = async (partCode: RoomProductPartCode, searchText: string) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const products = await searchCatalog(partCode, searchText.trim());
      if (requestSequence.current === requestId) setResults(products);
    } catch {
      if (requestSequence.current === requestId) {
        setResults([]);
        setError("검증 상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  };

  const openPart = (partCode: RoomProductPartCode) => {
    if (disabled) return;
    setActivePart(partCode);
    setQuery("");
    setResults([]);
    setError(null);
    setSelectionRevision((current) => current + 1);
    const region = value.regions?.[partCode];
    if (region && region.sourceRenderKey === value.sourceRenderKey) {
      void loadProducts(partCode, "");
    }
  };

  const confirmBoundary = (
    region: SamPolygonResult,
    definition: RoomProductPartDefinition,
  ) => {
    if (!value.sourceRenderKey) {
      setError("현재 생성 이미지의 작업 식별자를 확인할 수 없습니다. 이미지를 다시 선택해 주세요.");
      return;
    }
    const boundary: RoomProductRegionSelection = {
      sourceRenderKey: value.sourceRenderKey,
      polygon: region.polygon,
      imageSize: region.image_size,
      maskUrl: region.mask_url || undefined,
      confidence: region.confidence,
      areaPixels: region.area_pixels,
      targetSurface: samTargetForPart(definition),
    };
    onChange({
      ...value,
      regions: {
        ...(value.regions || {}),
        [definition.partCode]: boundary,
      },
    });
    void loadProducts(definition.partCode, "");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activePart && boundaryMatchesSource) void loadProducts(activePart, query);
  };

  const chooseProduct = (product: RoomCatalogProduct) => {
    if (!activePart || !boundaryMatchesSource) return;
    if (!product.sku || !product.provenance.verifiedAt) return;
    onChange({
      ...value,
      selections: {
        ...value.selections,
        [activePart]: { partCode: activePart, product },
      },
    });
    setError(null);
  };

  const removeProduct = (partCode: RoomProductPartCode) => {
    const selections = { ...value.selections };
    delete selections[partCode];
    onChange({ ...value, selections });
  };

  const resetBoundary = () => {
    if (!activePart) return;
    const regions = { ...(value.regions || {}) };
    delete regions[activePart];
    onChange({ ...value, regions });
    setResults([]);
    setQuery("");
    setError(null);
    setSelectionRevision((current) => current + 1);
  };

  const regenerate = async () => {
    if (
      regenerating ||
      !activeDefinition ||
      !activeSelection ||
      !activeRegion ||
      !boundaryMatchesSource
    ) {
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const promptMarkdown = buildRoomProductPromptMarkdown(
        value,
        activeDefinition.partCode,
      );
      await onRegenerate({
        partCode: activeDefinition.partCode,
        targetSurface: activeRegion.targetSurface,
        product: activeSelection.product,
        region: activeRegion,
        promptMarkdown,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "선택 경계에 제품을 적용하지 못했습니다.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  const activeReady = Boolean(
    activeDefinition && activeSelection && activeRegion && boundaryMatchesSource,
  );

  return (
    <section
      aria-label={`${value.roomName} 실제 제품 선택`}
      className={`rounded-[28px] border border-black/10 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black/45">
            Boundary-based product restyle
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-black">
            {value.roomName} · 경계를 읽고 실제 제품 선택
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">
            변경할 부위를 고른 뒤 이미지 안쪽을 클릭하세요. 확인한 경계와 검증 SKU를
            GPT Image 2에 함께 전달하고, 경계 밖 원본은 그대로 보존합니다.
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-black/65">
          SKU 선택 {selectedDefinitions.length}/{definitions.length}
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <div className="relative min-w-0 rounded-[24px] border border-black/10 bg-white p-3">
          {activeDefinition ? (
            <ClickableRenderImage
              key={`${value.sourceRenderKey || "render"}:${activeDefinition.partCode}:${selectionRevision}`}
              imageUrl={imageUrl}
              imageAlt={`${value.roomName} 1차 생성 이미지`}
              initialMode="select"
              fixedTargetSurface={samTargetForPart(activeDefinition)}
              initialSelection={
                boundaryMatchesSource ? toSamSelection(activeRegion) : null
              }
              onImageError={() => {
                setImageRecovering(true);
                onImageError?.();
              }}
              onConfirm={(region) => confirmBoundary(region, activeDefinition)}
              confirmLabel={`${activeDefinition.labelKo} 경계 확정 · SKU 보기`}
              hint="다른 면이 포함되면 추가·제외 점으로 경계를 보정한 뒤 확정하세요."
            />
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-white">
              <img
                src={imageUrl}
                alt={`${value.roomName} 1차 생성 이미지`}
                className="block h-auto w-full select-none object-contain"
                onLoad={() => setImageRecovering(false)}
                onError={() => {
                  setImageRecovering(true);
                  onImageError?.();
                }}
              />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-white/55 bg-white/90 p-3 text-center shadow-lg backdrop-blur">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-black">
                  <Crosshair className="h-3.5 w-3.5" />
                  오른쪽에서 변경할 부위를 먼저 선택하세요
                </p>
                <p className="mt-1 text-[0.68rem] text-black/50">
                  고정 화살표 없이 실제 클릭 위치의 경계를 분석합니다.
                </p>
              </div>
            </div>
          )}

          {imageRecovering ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[24px] bg-white/95 p-6 text-center">
              <div>
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-black/55" />
                <p className="mt-3 text-xs font-bold text-black/60">
                  결제한 이미지의 안전한 열람 주소를 갱신하고 있어요
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-[24px] border border-black/10 bg-white p-4 sm:p-5">
          {activeDefinition ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-black/45">선택 부위</p>
                  <h3 className="mt-1 text-lg font-extrabold text-black">
                    {activeDefinition.labelKo}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-black/55">
                    {activeDefinition.helpKo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePart(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white"
                  aria-label="부위 선택 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`mt-4 rounded-xl border p-3 ${
                  boundaryMatchesSource
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-black/10 bg-[#f7f7f5]"
                }`}
              >
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-black">
                  {boundaryMatchesSource ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" />
                  )}
                  {boundaryMatchesSource
                    ? "현재 이미지의 경계가 확정됐습니다"
                    : "왼쪽 이미지에서 경계를 먼저 확정하세요"}
                </p>
                {boundaryMatchesSource && activeRegion ? (
                  <p className="mt-1 text-[0.65rem] text-black/50">
                    신뢰도 {Math.round(activeRegion.confidence * 100)}% · 이미지 면적의{" "}
                    {(
                      (activeRegion.areaPixels /
                        Math.max(1, activeRegion.imageSize[0] * activeRegion.imageSize[1])) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={resetBoundary}
                  className="mt-2 inline-flex items-center gap-1 text-[0.68rem] font-bold text-black/55 underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  경계 다시 선택
                </button>
              </div>

              {boundaryMatchesSource ? (
                <>
                  <form onSubmit={submitSearch} className="mt-4 flex gap-2" role="search">
                    <label className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                      <span className="sr-only">제품명, 브랜드 또는 SKU</span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="제품명 · 브랜드 · SKU"
                        className="w-full rounded-xl border border-black/15 bg-white py-2.5 pl-9 pr-3 text-sm text-black outline-none focus:border-black"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      검색
                    </button>
                  </form>

                  {activeSelection ? (
                    <div className="mt-3 rounded-xl border border-black bg-black p-3 text-white">
                      <span className="text-[0.62rem] font-bold text-white/55">
                        적용할 검증 SKU
                      </span>
                      <strong className="mt-1 block text-sm">
                        {activeSelection.product.displayName}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-white/65">
                        {[activeSelection.product.brand, activeSelection.product.sku]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  ) : null}

                  {loading ? (
                    <div
                      role="status"
                      className="mt-6 flex items-center justify-center gap-2 text-sm text-black/55"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" /> 검증 SKU 조회 중
                    </div>
                  ) : null}
                  {!loading && !error && results.length === 0 ? (
                    <p className="mt-5 rounded-xl border border-dashed border-black/15 bg-white p-4 text-xs leading-5 text-black/50">
                      이 부위에 연결된 검증 SKU가 없습니다. 임의 상품이나 가상 모델명은
                      표시하지 않습니다.
                    </p>
                  ) : null}
                  <ul className="mt-4 max-h-[30rem] space-y-2 overflow-y-auto pr-1">
                    {results.map((product) => {
                      const selected =
                        activeSelection?.product.materialProductId ===
                        product.materialProductId;
                      return (
                        <li key={product.materialProductId}>
                          <button
                            type="button"
                            onClick={() => chooseProduct(product)}
                            className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
                              selected
                                ? "border-black bg-[#f7f7f5]"
                                : "border-black/10 bg-white hover:border-black"
                            }`}
                          >
                            {product.thumbnailUrl ? (
                              <img
                                src={product.thumbnailUrl}
                                alt=""
                                className="h-16 w-16 shrink-0 rounded-xl border border-black/5 object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white text-[0.6rem] text-black/35">
                                이미지 없음
                              </div>
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold text-black">
                                {product.displayName}
                              </span>
                              <span className="mt-1 block truncate text-xs font-bold text-black/65">
                                {[product.brand, product.sku]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-[0.68rem] leading-4 text-black/45">
                                {product.spec || "규격 정보 없음"}
                              </span>
                              <span className="mt-1.5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-800">
                                SKU 검증 · {product.provenance.verifiedAt?.slice(0, 10)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <>
              <h3 className="text-base font-extrabold text-black">변경할 부위</h3>
              <p className="mt-1 text-xs leading-5 text-black/50">
                부위를 선택한 다음 사진 안쪽을 직접 클릭합니다.
              </p>
              <ul className="mt-3 space-y-2">
                {definitions.map((part) => {
                  const selected = Boolean(value.selections[part.partCode]);
                  const boundary =
                    value.regions?.[part.partCode]?.sourceRenderKey ===
                    value.sourceRenderKey;
                  return (
                    <li key={part.partCode}>
                      <button
                        type="button"
                        disabled={disabled || regenerating}
                        onClick={() => openPart(part.partCode)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 text-left transition hover:border-black disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-extrabold text-black">
                            {selected ? (
                              <Check className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Crosshair className="h-3.5 w-3.5 shrink-0 text-black/35" />
                            )}
                            {part.labelKo}
                          </span>
                          <span className="mt-1 block truncate text-[0.65rem] text-black/48">
                            {selectedLabel(value, part.partCode)}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[0.6rem] font-bold ${
                            boundary
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-[#f7f7f5] text-black/45"
                          }`}
                        >
                          {boundary ? "경계 완료" : "경계 선택"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selectedDefinitions.length > 0 ? (
                <div className="mt-5 border-t border-black/10 pt-4">
                  <p className="text-xs font-extrabold text-black">선택한 제품</p>
                  <ul className="mt-2 space-y-2">
                    {selectedDefinitions.map((part) => {
                      const product = value.selections[part.partCode]!.product;
                      return (
                        <li
                          key={part.partCode}
                          className="flex items-start justify-between gap-2 rounded-xl bg-[#f7f7f5] p-3"
                        >
                          <div className="min-w-0">
                            <span className="text-[0.62rem] font-bold text-black/45">
                              {part.labelKo}
                            </span>
                            <strong className="mt-0.5 block truncate text-xs text-black">
                              {product.displayName}
                            </strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProduct(part.partCode)}
                            className="shrink-0 text-[0.65rem] font-semibold text-black/45 underline"
                          >
                            삭제
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <footer className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-5 text-black/48">
          경계와 실제 SKU가 프롬프트·견적에 함께 저장됩니다. GPT Image 2 결과는 선택한
          경계 안쪽에만 합성하고 경계 밖 픽셀은 원본으로 고정합니다.
        </p>
        <button
          type="button"
          disabled={disabled || regenerating || !activeReady}
          onClick={() => void regenerate()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-extrabold text-white transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {regenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {regenerating
            ? "선택 경계 재생성 중"
            : activeDefinition
              ? `${activeDefinition.labelKo} 경계에 image-2 적용`
              : "부위와 SKU를 선택하세요"}
          {!regenerating && activeDefinition ? (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]">
              ⬢ 2
            </span>
          ) : null}
          {!regenerating ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </footer>
    </section>
  );
}
