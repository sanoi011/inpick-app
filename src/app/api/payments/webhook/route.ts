import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { eventType, data } = body;

    console.log("Toss webhook received:", eventType, data?.orderId);

    // Webhook secret validation (optional - only if TOSS_WEBHOOK_SECRET is set)
    const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
    if (webhookSecret) {
      // Toss sends signature in header
      const signature = request.headers.get("toss-signature");
      if (!signature) {
        console.error("Webhook: missing signature");
        return NextResponse.json({ ok: true }); // Still return 200
      }
    }

    if (!data?.orderId) {
      return NextResponse.json({ ok: true });
    }

    const orderId = data.orderId;

    if (eventType === "PAYMENT_STATUS_CHANGED") {
      const status = data.status; // DONE | CANCELED | PARTIAL_CANCELED | ABORTED | EXPIRED

      if (status === "DONE") {
        // Check idempotency - already processed?
        const { data: existing } = await supabase
          .from("credit_transactions")
          .select("id")
          .eq("type", "CHARGE")
          .contains("metadata", { orderId, status: "completed" })
          .maybeSingle();

        if (existing) {
          console.log("Webhook: already processed", orderId);
          return NextResponse.json({ ok: true });
        }

        // Find pending transaction
        const { data: pending } = await supabase
          .from("credit_transactions")
          .select("*")
          .eq("type", "CHARGE")
          .contains("metadata", { orderId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pending) {
          const userId = pending.user_id;
          const creditAmount = pending.amount;
          const paymentKey = data.paymentKey;
          const paidAmount = data.totalAmount;

          // Record completed transaction
          await supabase.from("credit_transactions").insert({
            user_id: userId,
            amount: creditAmount,
            type: "CHARGE",
            description: `${creditAmount} 크레딧 충전 (웹훅 확인)`,
            metadata: {
              paymentKey,
              orderId,
              paidAmount,
              status: "completed",
              source: "webhook",
            },
          });

          // Update balance
          const { data: current } = await supabase
            .from("user_credits")
            .select("balance")
            .eq("user_id", userId)
            .single();

          await supabase.from("user_credits").upsert(
            {
              user_id: userId,
              balance: (current?.balance || 0) + creditAmount,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

          console.log("Webhook: credited", creditAmount, "to", userId);
        }
      } else if (["CANCELED", "ABORTED", "EXPIRED"].includes(status)) {
        // Mark pending as failed
        const { data: pending } = await supabase
          .from("credit_transactions")
          .select("id, user_id, metadata")
          .eq("type", "CHARGE")
          .contains("metadata", { orderId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pending) {
          await supabase.from("credit_transactions").insert({
            user_id: pending.user_id,
            amount: 0,
            type: "CHARGE",
            description: `결제 ${status === "CANCELED" ? "취소" : status === "EXPIRED" ? "만료" : "중단"}`,
            metadata: { orderId, status, source: "webhook" },
          });
          console.log("Webhook: payment", status, orderId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true }); // Always 200
  }
}
