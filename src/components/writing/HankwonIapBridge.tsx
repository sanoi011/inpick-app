"use client";

import { useEffect, useRef } from "react";

const PRODUCTS = ["kr.aiod.hankwon.pro.monthly", "kr.aiod.hankwon.max.monthly"] as const;

type NativeTransaction = {
  transactionId?: string;
  /** Apple StoreKit 2 signed transaction. The Hankwon server verifies this JWS before provisioning. */
  jwsRepresentation?: string;
  products: Array<{ id: string }>;
  finish: () => Promise<void>;
};
type NativeProduct = {
  id: string;
  pricing?: { price?: string };
  getOffer: () => { order: () => Promise<{ isError?: boolean; message?: string } | undefined> } | undefined;
};
type PurchaseStore = {
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms: string[]) => Promise<unknown>;
  update: () => Promise<unknown>;
  get: (id: string, platform?: string) => NativeProduct | undefined;
  restorePurchases: () => Promise<unknown>;
  when: () => {
    approved: (callback: (transaction: NativeTransaction) => void) => unknown;
    productUpdated: (callback: () => void) => unknown;
  };
};
type PurchaseNamespace = {
  store: PurchaseStore;
  ProductType: { PAID_SUBSCRIPTION: string };
  Platform: { APPLE_APPSTORE: string };
};

function purchaseNamespace() {
  return (window as unknown as { CdvPurchase?: PurchaseNamespace }).CdvPurchase;
}

export function HankwonIapBridge({
  targetWindow,
  targetOrigin,
}: {
  targetWindow: () => Window | null;
  targetOrigin: string;
}) {
  const initialized = useRef(false);
  const initializing = useRef<Promise<void> | null>(null);
  const transactions = useRef(new Map<string, NativeTransaction>());

  useEffect(() => {
    let disposed = false;
    const isHankwonNative = /HankwonNative\//.test(window.navigator.userAgent);

    const post = (payload: Record<string, unknown>) => {
      if (!disposed) targetWindow()?.postMessage(payload, targetOrigin);
    };

    const postProducts = () => {
      const cdv = purchaseNamespace();
      if (!cdv) return;
      post({
        type: "hankwon:iap:products",
        available: isHankwonNative,
        products: PRODUCTS.map((id) => ({ id, price: cdv.store.get(id, cdv.Platform.APPLE_APPSTORE)?.pricing?.price || null })),
      });
    };

    const ensureStore = async () => {
      if (!isHankwonNative) {
        post({ type: "hankwon:iap:products", available: false, products: [] });
        return;
      }
      if (initialized.current) {
        postProducts();
        return;
      }
      if (initializing.current) return initializing.current;
      initializing.current = (async () => {
        try {
          if (!purchaseNamespace()) {
            // Capacitor 원격 페이지에서는 네이티브 플러그인의 JS 래퍼를 명시적으로 로드한다.
            // @ts-expect-error cordova 플러그인은 전역 namespace를 생성한다.
            await import("cordova-plugin-purchase/www/store.js");
          }
          const cdv = purchaseNamespace();
          if (!cdv?.store) throw new Error("STOREKIT_NOT_AVAILABLE");
          cdv.store.register(PRODUCTS.map((id) => ({
            id,
            type: cdv.ProductType.PAID_SUBSCRIPTION,
            platform: cdv.Platform.APPLE_APPSTORE,
          })));
          cdv.store.when().approved((transaction) => {
            const productId = transaction.products[0]?.id;
            if (!transaction.transactionId || !productId || !PRODUCTS.includes(productId as typeof PRODUCTS[number])) return;
            transactions.current.set(transaction.transactionId, transaction);
            post({
              type: "hankwon:iap:approved",
              transactionId: transaction.transactionId,
              productId,
              signedTransactionInfo: transaction.jwsRepresentation || null,
            });
          });
          cdv.store.when().productUpdated(() => postProducts());
          await cdv.store.initialize([cdv.Platform.APPLE_APPSTORE]);
          initialized.current = true;
          await cdv.store.update();
          postProducts();
        } catch (error) {
          post({ type: "hankwon:iap:error", error: error instanceof Error ? error.message : "STOREKIT_INIT_FAILED" });
        } finally {
          initializing.current = null;
        }
      })();
      return initializing.current;
    };

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== targetOrigin || event.source !== targetWindow()) return;
      const type = event.data?.type;
      if (type === "hankwon:iap:ready") {
        await ensureStore();
        return;
      }
      if (type === "hankwon:iap:purchase") {
        const productId = event.data?.productId;
        if (!PRODUCTS.includes(productId)) return;
        await ensureStore();
        const cdv = purchaseNamespace();
        const offer = cdv?.store.get(productId, cdv.Platform.APPLE_APPSTORE)?.getOffer();
        if (!offer) {
          post({ type: "hankwon:iap:error", error: "PRODUCT_NOT_AVAILABLE" });
          return;
        }
        const result = await offer.order();
        if (result?.isError !== false && result?.message) post({ type: "hankwon:iap:error", error: result.message });
        return;
      }
      if (type === "hankwon:iap:finish") {
        const transactionId = String(event.data?.transactionId || "");
        const transaction = transactions.current.get(transactionId);
        if (!transaction) return;
        await transaction.finish();
        transactions.current.delete(transactionId);
        post({ type: "hankwon:iap:finished", transactionId });
        return;
      }
      if (type === "hankwon:iap:restore") {
        await ensureStore();
        await purchaseNamespace()?.store.restorePurchases();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      disposed = true;
      window.removeEventListener("message", onMessage);
    };
  }, [targetOrigin, targetWindow]);

  return null;
}
