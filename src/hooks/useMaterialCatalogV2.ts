"use client";

import { useState, useCallback, useMemo } from "react";
import {
  getAllCategories,
  getCategoriesForRoom,
  getProductById,
  type MaterialCategory,
  type MaterialProduct,
} from "@/lib/data/material-catalog-v2";

export interface SelectedProductEntry {
  categoryCode: string;
  productId: string;
}

export function useMaterialCatalogV2() {
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, string>
  >({}); // categoryCode → productId

  const allCategories = useMemo(() => getAllCategories(), []);

  const categoriesForRoom = useCallback(
    (roomType: string): MaterialCategory[] => {
      return getCategoriesForRoom(roomType);
    },
    []
  );

  const selectProduct = useCallback(
    (categoryCode: string, productId: string) => {
      setSelectedProducts((prev) => ({ ...prev, [categoryCode]: productId }));
    },
    []
  );

  const deselectProduct = useCallback((categoryCode: string) => {
    setSelectedProducts((prev) => {
      const next = { ...prev };
      delete next[categoryCode];
      return next;
    });
  }, []);

  const toggleProduct = useCallback(
    (categoryCode: string, productId: string) => {
      setSelectedProducts((prev) => {
        if (prev[categoryCode] === productId) {
          const next = { ...prev };
          delete next[categoryCode];
          return next;
        }
        return { ...prev, [categoryCode]: productId };
      });
    },
    []
  );

  const getSelectedProduct = useCallback(
    (categoryCode: string): MaterialProduct | null => {
      const pid = selectedProducts[categoryCode];
      if (!pid) return null;
      const result = getProductById(pid);
      return result?.product ?? null;
    },
    [selectedProducts]
  );

  const selectedCount = useMemo(
    () => Object.keys(selectedProducts).length,
    [selectedProducts]
  );

  const totalCategories = allCategories.length;

  // 총 자재비 계산 (단가 기준, 수량 미적용)
  const totalMaterialCost = useMemo(() => {
    let total = 0;
    for (const [, productId] of Object.entries(selectedProducts)) {
      const result = getProductById(productId);
      if (result) {
        total += result.product.unitPrice + result.product.laborPrice;
        for (const sub of result.product.subItems) {
          total += sub.unitPrice;
        }
      }
    }
    return total;
  }, [selectedProducts]);

  // 선택된 자재 목록 전체 반환
  const getSelectedEntries = useCallback((): SelectedProductEntry[] => {
    return Object.entries(selectedProducts).map(([categoryCode, productId]) => ({
      categoryCode,
      productId,
    }));
  }, [selectedProducts]);

  // 일괄 로드 (프로젝트 저장 데이터에서 복원)
  const loadSelections = useCallback(
    (selections: Record<string, string>) => {
      setSelectedProducts(selections);
    },
    []
  );

  return {
    allCategories,
    categoriesForRoom,
    selectedProducts,
    selectProduct,
    deselectProduct,
    toggleProduct,
    getSelectedProduct,
    selectedCount,
    totalCategories,
    totalMaterialCost,
    getSelectedEntries,
    loadSelections,
  };
}
