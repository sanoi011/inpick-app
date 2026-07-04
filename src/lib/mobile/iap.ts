/**
 * 네이티브 인앱결제(IAP) 서비스 — cordova-plugin-purchase 래퍼.
 *
 * 흐름 (지급 원칙 — 클라 성공만으로 지급 금지):
 *   1. purchaseWithIap(internalCode, appProductId)
 *   2. StoreKit2 / Play Billing 구매 (플러그인)
 *   3. approved → 서버 검증 POST /api/mobile/app-purchases/verify
 *      (Apple App Store Server API / Google Play Developer API 검증 → finalizer 지급)
 *   4. 검증·지급 성공 시에만 transaction.finish()
 *      실패 시 finish 안 함 → 다음 앱 실행 때 approved 재전달(재시도)
 *
 * 웹/브라우저에서는 isIapAvailable()=false — 호출부에서 토스 등 웹 경로 사용.
 */
import { detectPlatform } from "./platform";

/* ── cordova-plugin-purchase v13 최소 타입 ── */
interface CdvTransaction {
  transactionId?: string;
  products: Array<{ id: string }>;
  parentReceipt?: {
    nativePurchase?: { purchaseToken?: string; orderId?: string };
  };
  finish: () => Promise<void>;
}
interface CdvOffer {
  order: () => Promise<{ isError?: boolean; message?: string; code?: number } | undefined>;
}
interface CdvProduct {
  id: string;
  getOffer: () => CdvOffer | undefined;
  pricing?: { price?: string };
}
interface CdvStore {
  register: (p: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms: string[]) => Promise<unknown>;
  update: () => Promise<unknown>;
  get: (id: string, platform?: string) => CdvProduct | undefined;
  restorePurchases: () => Promise<unknown>;
  when: () => {
    approved: (cb: (tx: CdvTransaction) => void) => ReturnType<CdvStore["when"]>;
  };
}
interface CdvPurchaseNS {
  store: CdvStore;
  ProductType: { CONSUMABLE: string };
  Platform: { APPLE_APPSTORE: string; GOOGLE_PLAY: string };
}

declare global {
  interface Window {
    CdvPurchase?: CdvPurchaseNS;
  }
}

export interface IapPurchaseResult {
  ok: boolean;
  creditsAdded?: number;
  balanceAfter?: number;
  entitlementId?: string;
  cancelled?: boolean;
  error?: string;
}

/** 스토어 productId → 진행 중 구매 resolve 매핑 */
const pending = new Map<string, (r: IapPurchaseResult) => void>();
/** 스토어 productId → 우리 상품 code 매핑 (approved 핸들러에서 사용) */
const codeByAppProductId = new Map<string, string>();
const registeredIds = new Set<string>();
let storeInitialized = false;

export function isIapAvailable(): boolean {
  const p = detectPlatform();
  if (p !== "ios" && p !== "android") return false;
  return typeof window !== "undefined" && !!window.CdvPurchase?.store;
}

function nativePlatformConst(): string {
  const cdv = window.CdvPurchase!;
  return detectPlatform() === "ios" ? cdv.Platform.APPLE_APPSTORE : cdv.Platform.GOOGLE_PLAY;
}

/** approved 트랜잭션 → 서버 검증·지급 → finish */
async function handleApproved(tx: CdvTransaction): Promise<void> {
  const appProductId = tx.products[0]?.id;
  if (!appProductId) return;
  const internalCode = codeByAppProductId.get(appProductId);
  const resolve = pending.get(appProductId);
  if (!internalCode) {
    // 이번 세션에서 시작한 구매가 아님(재전달 등) — 코드 매핑 없으면 검증 불가, 다음 기회에 재시도
    return;
  }
  const platform = detectPlatform() === "ios" ? "ios" : "android";
  try {
    const res = await fetch("/api/mobile/app-purchases/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        internalProductId: internalCode,
        appProductId,
        transactionId: tx.transactionId ?? null,
        purchaseToken: tx.parentReceipt?.nativePurchase?.purchaseToken ?? null,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      alreadyProvisioned?: boolean;
      error?: string;
      hint?: string;
      finalize?: {
        creditsAdded?: number;
        balanceAfter?: number;
        entitlementId?: string;
      };
    };
    if (res.ok && data.ok) {
      // 검증+지급 성공 → 소모 처리 (여기서만 finish)
      await tx.finish();
      resolve?.({
        ok: true,
        creditsAdded: data.finalize?.creditsAdded,
        balanceAfter: data.finalize?.balanceAfter,
        entitlementId: data.finalize?.entitlementId,
      });
    } else {
      // finish 안 함 — 다음 앱 실행 시 approved 재전달로 재시도 가능
      resolve?.({ ok: false, error: data.hint || data.error || "구매 검증에 실패했습니다" });
    }
  } catch (err) {
    resolve?.({
      ok: false,
      error: err instanceof Error ? err.message : "구매 검증 통신 오류",
    });
  } finally {
    pending.delete(appProductId);
  }
}

/** 스토어 초기화 + 상품 등록 (여러 번 호출해도 안전) */
export async function ensureIapStore(
  products: Array<{ internalCode: string; appProductId: string }>,
): Promise<void> {
  if (!isIapAvailable()) throw new Error("IAP_NOT_AVAILABLE");
  const cdv = window.CdvPurchase!;
  const platform = nativePlatformConst();

  const toRegister = products.filter((p) => p.appProductId && !registeredIds.has(p.appProductId));
  for (const p of products) {
    if (p.appProductId) codeByAppProductId.set(p.appProductId, p.internalCode);
  }
  if (toRegister.length > 0) {
    cdv.store.register(
      toRegister.map((p) => ({
        id: p.appProductId,
        type: cdv.ProductType.CONSUMABLE,
        platform,
      })),
    );
    toRegister.forEach((p) => registeredIds.add(p.appProductId));
  }

  if (!storeInitialized) {
    cdv.store.when().approved((tx) => {
      void handleApproved(tx);
    });
    await cdv.store.initialize([platform]);
    storeInitialized = true;
  } else if (toRegister.length > 0) {
    await cdv.store.update();
  }
}

/** 스토어 표시 가격 (지역 통화 반영) — 없으면 null */
export function getIapDisplayPrice(appProductId: string): string | null {
  if (!isIapAvailable()) return null;
  const cdv = window.CdvPurchase!;
  return cdv.store.get(appProductId, nativePlatformConst())?.pricing?.price ?? null;
}

/**
 * 구매 실행. resolve 시점 = 서버 검증·지급 완료(또는 실패/취소).
 */
export async function purchaseWithIap(input: {
  internalCode: string;
  appProductId: string;
  timeoutMs?: number;
}): Promise<IapPurchaseResult> {
  await ensureIapStore([{ internalCode: input.internalCode, appProductId: input.appProductId }]);
  const cdv = window.CdvPurchase!;
  const product = cdv.store.get(input.appProductId, nativePlatformConst());
  const offer = product?.getOffer();
  if (!offer) {
    return { ok: false, error: "스토어에서 상품을 찾을 수 없습니다 (상품 등록/심사 상태 확인)" };
  }

  const resultPromise = new Promise<IapPurchaseResult>((resolve) => {
    pending.set(input.appProductId, resolve);
    // 타임아웃 — 유저가 결제창에서 오래 머물 수 있어 넉넉히
    setTimeout(() => {
      if (pending.get(input.appProductId) === resolve) {
        pending.delete(input.appProductId);
        resolve({ ok: false, error: "결제 응답 시간 초과 — 잔액은 잠시 후 자동 반영될 수 있습니다" });
      }
    }, input.timeoutMs ?? 180_000);
  });

  const orderErr = await offer.order();
  if (orderErr && orderErr.isError !== false) {
    pending.delete(input.appProductId);
    const msg = orderErr.message || "";
    const cancelled = /cancel/i.test(msg) || orderErr.code === 6777006; // USER_CANCELLED
    return cancelled
      ? { ok: false, cancelled: true }
      : { ok: false, error: msg || "구매 시작 실패" };
  }
  return resultPromise;
}

/** 구매 복원 — 미지급 approved 재전달 트리거 */
export async function restoreIapPurchases(): Promise<void> {
  if (!isIapAvailable()) return;
  await window.CdvPurchase!.store.restorePurchases();
}
