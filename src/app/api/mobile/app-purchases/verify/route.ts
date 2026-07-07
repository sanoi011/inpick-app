/**
 * POST /api/mobile/app-purchases/verify
 *
 * 앱스토어/구글플레이 구매 검증 + finalize.
 *
 * 흐름:
 *   1. requireConsumerUser
 *   2. internal product 조회
 *   3. app_purchase_transactions upsert (idempotency: transactionId|purchaseToken)
 *   4. Apple/Google 서버 검증
 *   5. 검증 성공 시 payment_intents 생성 + finalize 호출
 *   6. 결과 반환
 *
 * 절대 금지: 클라이언트가 "구매 성공" 보낸 것만 믿고 지급
 * 가이드: §12-2
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { verifyAppStoreTransaction } from "@/lib/inpick/payments/providers/app-store-provider";
import {
  verifyGooglePlayPurchase,
  acknowledgeGooglePlayPurchase,
} from "@/lib/inpick/payments/providers/google-play-provider";
import { finalizePaymentProvisioning } from "@/lib/inpick/payments/finalize-provisioning";
import { trackServerEventAsync } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Body {
  platform?: "ios" | "android";
  internalProductId?: string;
  appProductId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  purchaseToken?: string;
  appBuildVersion?: string;
  appInstallationId?: string;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.platform || !body.internalProductId || !body.appProductId) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (body.platform === "ios" && !body.transactionId) {
    return NextResponse.json({ error: "ios_requires_transactionId" }, { status: 400 });
  }
  if (body.platform === "android" && !body.purchaseToken) {
    return NextResponse.json({ error: "android_requires_purchaseToken" }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_not_configured" }, { status: 503 });

  // 1) internal product 조회
  const { data: productRaw } = await admin
    .from("payment_products")
    .select("*")
    .eq("code", body.internalProductId)
    .eq("is_active", true)
    .maybeSingle();
  const product = productRaw as {
    id: string;
    code: string;
    product_type: string;
    name_ko: string;
    amount_krw: number;
    credit_amount: number;
    bonus_credit_amount: number;
    app_store_product_id: string | null;
    google_play_product_id: string | null;
  } | null;

  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  // 2) appProductId 일치 검증
  const expectedAppId = body.platform === "ios" ? product.app_store_product_id : product.google_play_product_id;
  if (expectedAppId !== body.appProductId) {
    return NextResponse.json({ error: "app_product_id_mismatch" }, { status: 400 });
  }

  const idempotencyKey = body.platform === "ios"
    ? `ios:${body.transactionId}`
    : `android:${body.purchaseToken}`;

  // 3) idempotency 확인 (이미 처리된 transaction)
  const { data: existing } = await admin
    .from("app_purchase_transactions")
    .select("id, verification_status, entitlement_status, payment_intent_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  const existingTx = existing as {
    id: string;
    verification_status: string;
    entitlement_status: string;
    payment_intent_id: string | null;
  } | null;

  if (existingTx && existingTx.entitlement_status === "granted") {
    return NextResponse.json({
      ok: true,
      alreadyProvisioned: true,
      paymentIntentId: existingTx.payment_intent_id,
    });
  }

  // 4) 외부 검증
  let verifyResult: {
    verified: boolean;
    error?: string;
    rawPayload?: Record<string, unknown>;
    productId?: string;
    transactionId?: string;
    originalTransactionId?: string;
  };

  if (body.platform === "ios") {
    const r = await verifyAppStoreTransaction({ transactionId: body.transactionId! });
    verifyResult = {
      verified: r.verified,
      error: r.error,
      rawPayload: r.rawPayload,
      productId: r.productId,
      transactionId: r.transactionId,
      originalTransactionId: r.originalTransactionId,
    };
  } else {
    const r = await verifyGooglePlayPurchase({
      productId: body.appProductId,
      purchaseToken: body.purchaseToken!,
    });
    verifyResult = {
      verified: r.verified,
      error: r.error,
      rawPayload: r.rawPayload,
      productId: r.productId,
    };
  }

  // 5) transaction row upsert
  const txData = {
    platform: body.platform,
    user_id: user.id,
    internal_product_id: product.code,
    app_product_id: body.appProductId,
    transaction_id: body.transactionId ?? null,
    original_transaction_id: body.originalTransactionId ?? verifyResult.originalTransactionId ?? null,
    purchase_token: body.purchaseToken ?? null,
    purchase_state: verifyResult.verified ? "purchased" : "unverified",
    verification_status: verifyResult.verified ? "verified" : "failed",
    entitlement_status: "pending",
    raw_payload: verifyResult.rawPayload ?? null,
    verified_payload: verifyResult.verified ? verifyResult.rawPayload : null,
    idempotency_key: idempotencyKey,
    purchased_at: new Date().toISOString(),
    verified_at: verifyResult.verified ? new Date().toISOString() : null,
  };

  let txId: string;
  if (existingTx) {
    await (admin.from("app_purchase_transactions") as ReturnType<typeof admin.from>)
      .update(txData as never)
      .eq("id", existingTx.id);
    txId = existingTx.id;
  } else {
    const { data: inserted, error: insErr } = await (admin.from("app_purchase_transactions") as ReturnType<typeof admin.from>)
      .insert(txData as never)
      .select("id")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json({ error: "tx_insert_failed", hint: insErr?.message }, { status: 500 });
    }
    txId = (inserted as { id: string }).id;
  }

  if (!verifyResult.verified) {
    return NextResponse.json(
      { ok: false, error: "verification_failed", hint: verifyResult.error, txId },
      { status: 400 }
    );
  }

  // 스토어 영수증 검증 성공 계측 (fire-and-forget)
  trackServerEventAsync({
    eventName: AnalyticsEvents.IapVerified,
    actorType: "consumer",
    userId: user.id,
    source: "api",
    props: {
      productId: product.code,
      appProductId: body.appProductId,
      platform: body.platform,
      amountKrw: product.amount_krw,
    },
  });

  // 6) payment_intents 생성 + product_snapshot 저장
  const productSnapshot = {
    productId: product.code,
    productType: product.product_type,
    displayName: product.name_ko,
    amountKrw: product.amount_krw,
    currency: "KRW",
    tokenAmount: product.credit_amount,
    bonusTokenAmount: product.bonus_credit_amount,
    totalTokenAmount: (product.credit_amount ?? 0) + (product.bonus_credit_amount ?? 0),
    capturedAt: new Date().toISOString(),
    platform: body.platform,
    appProductId: body.appProductId,
  };

  const orderId = `INPICK_APP_${body.platform.toUpperCase()}_${Date.now()}_${idempotencyKey.slice(-8)}`;
  const { data: intent, error: intentErr } = await (admin.from("payment_intents") as ReturnType<typeof admin.from>)
    .insert({
      user_id: user.id,
      product_id: product.id,
      order_id: orderId,
      order_name: `INPICK ${product.name_ko}`,
      product_type: product.product_type,
      amount_krw: product.amount_krw,
      status: "paid",
      provider: body.platform === "ios" ? "app_store" : "google_play",
      channel: body.platform === "ios" ? "ios_storekit" : "android_play_billing",
      platform: body.platform,
      customer_key: user.id,
      product_snapshot: productSnapshot,
      token_amount: product.credit_amount,
      bonus_token_amount: product.bonus_credit_amount,
      app_build_version: body.appBuildVersion ?? null,
      app_installation_id: body.appInstallationId ?? null,
      metadata: { productCode: product.code, appPurchaseTxId: txId },
    } as never)
    .select("id")
    .single();

  if (intentErr || !intent) {
    return NextResponse.json({ error: "intent_create_failed", hint: intentErr?.message }, { status: 500 });
  }
  const intentId = (intent as { id: string }).id;

  // app_purchase_transactions에 payment_intent_id 연결
  await (admin.from("app_purchase_transactions") as ReturnType<typeof admin.from>)
    .update({ payment_intent_id: intentId } as never)
    .eq("id", txId);

  // payments row 생성 (snapshot)
  const { data: payment } = await (admin.from("payments") as ReturnType<typeof admin.from>)
    .insert({
      payment_intent_id: intentId,
      user_id: user.id,
      provider: body.platform === "ios" ? "app_store" : "google_play",
      payment_key: idempotencyKey,
      order_id: orderId,
      method: "in_app_purchase",
      amount_krw: product.amount_krw,
      status: "DONE",
      approved_at: new Date().toISOString(),
      raw_payment: verifyResult.rawPayload ?? {},
    } as never)
    .select("id")
    .single();

  // 7) Google Play는 acknowledge (3일 내 필수)
  if (body.platform === "android" && body.purchaseToken) {
    void acknowledgeGooglePlayPurchase({
      productId: body.appProductId,
      purchaseToken: body.purchaseToken,
    });
  }

  // 8) finalize
  const finalizeResult = await finalizePaymentProvisioning(
    intentId,
    (payment as { id: string } | null)?.id,
  );

  // entitlement_status 업데이트
  const granted =
    finalizeResult.status === "provisioned" || finalizeResult.status === "already_provisioned";
  await (admin.from("app_purchase_transactions") as ReturnType<typeof admin.from>)
    .update({
      entitlement_status: granted ? "granted" : "failed",
      provisioned_at: new Date().toISOString(),
    } as never)
    .eq("id", txId);

  // 지급 완료 계측 (fire-and-forget)
  if (granted) {
    trackServerEventAsync({
      eventName: AnalyticsEvents.IapProvisioned,
      actorType: "consumer",
      userId: user.id,
      source: "api",
      props: {
        productId: product.code,
        appProductId: body.appProductId,
        platform: body.platform,
        creditsAdded: finalizeResult.creditsAdded,
        alreadyProvisioned: finalizeResult.status === "already_provisioned",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    paymentIntentId: intentId,
    txId,
    finalize: finalizeResult,
  });
}
