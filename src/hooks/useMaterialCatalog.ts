"use client";

import { useState, useEffect } from "react";
import type { SubMaterial } from "@/types/consumer-project";

interface MaterialOption {
  name: string;
  spec: string;
  price: number;
  unit: string;
  subMaterials: SubMaterial[];
}

interface MaterialGroup {
  category: string;
  part: string;
  options: MaterialOption[];
}

type MaterialCatalog = Record<string, MaterialGroup[]>;

// 하드코딩 폴백 (DB 실패 시 사용)
const FALLBACK_CATALOG: MaterialCatalog = {
  LIVING: [
    { category: "바닥", part: "거실 바닥", options: [
      { name: "강화마루", spec: "12mm 오크", price: 35000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "레벨링", unitPrice: 8000, unit: "m²" }, { name: "걸레받이", specification: "PVC 60mm", unitPrice: 3000, unit: "m" }] },
      { name: "원목마루", spec: "15mm 월넛", price: 85000, unit: "m²", subMaterials: [{ name: "바닥 밑작업", specification: "합판깔기", unitPrice: 15000, unit: "m²" }, { name: "걸레받이", specification: "원목 80mm", unitPrice: 8000, unit: "m" }] },
      { name: "타일", spec: "600x600 포세린", price: 45000, unit: "m²", subMaterials: [{ name: "타일 시멘트", specification: "접착제", unitPrice: 5000, unit: "m²" }, { name: "줄눈재", specification: "2mm", unitPrice: 2000, unit: "m²" }] },
    ] },
    { category: "벽", part: "거실 벽면", options: [
      { name: "실크 벽지", spec: "LG하우시스 친환경", price: 12000, unit: "m²", subMaterials: [{ name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" }] },
      { name: "포인트 벽지", spec: "수입 패턴 벽지", price: 25000, unit: "m²", subMaterials: [{ name: "초배지", specification: "합지", unitPrice: 3000, unit: "m²" }] },
      { name: "페인트", spec: "벤자민무어 매트", price: 18000, unit: "m²", subMaterials: [{ name: "퍼티 작업", specification: "2회", unitPrice: 5000, unit: "m²" }] },
    ] },
    { category: "천장", part: "거실 천장", options: [
      { name: "도장", spec: "KCC 수성페인트", price: 8000, unit: "m²", subMaterials: [] },
      { name: "우물천장", spec: "석고보드 + 몰딩", price: 35000, unit: "m²", subMaterials: [{ name: "석고보드", specification: "9.5mm", unitPrice: 5000, unit: "m²" }, { name: "크라운 몰딩", specification: "PU 120mm", unitPrice: 12000, unit: "m" }] },
    ] },
  ],
};

// 캐시
let catalogCache: MaterialCatalog | null = null;
let fetchPromise: Promise<MaterialCatalog> | null = null;

async function fetchCatalog(): Promise<MaterialCatalog> {
  if (catalogCache) return catalogCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/materials")
    .then((res) => {
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    })
    .then((data) => {
      const materials = data.materials as MaterialCatalog;
      if (materials && Object.keys(materials).length > 0) {
        catalogCache = materials;
        return materials;
      }
      return FALLBACK_CATALOG;
    })
    .catch(() => FALLBACK_CATALOG)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

export function useMaterialCatalog(roomType?: string) {
  const [materials, setMaterials] = useState<MaterialGroup[]>([]);
  const [allMaterials, setAllMaterials] = useState<MaterialCatalog>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setAllMaterials(catalog);
        if (roomType) {
          setMaterials(
            catalog[roomType] ||
            catalog[roomType.replace("MASTER_", "")] ||
            catalog["LIVING"] ||
            []
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [roomType]);

  const getMaterialsForRoom = (rt: string): MaterialGroup[] => {
    return (
      allMaterials[rt] ||
      allMaterials[rt.replace("MASTER_", "")] ||
      allMaterials["LIVING"] ||
      FALLBACK_CATALOG["LIVING"] ||
      []
    );
  };

  return { materials, allMaterials, loading, error, getMaterialsForRoom };
}
