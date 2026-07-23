import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260723025000_apps_in_toss_atomic_provisioning.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Apps in Toss token provisioning is atomic and serialized", () => {
  assert.match(
    migration,
    /function public\.provision_apps_in_toss_tokens_v1/i,
  );
  assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /from public\.token_wallets[\s\S]*for update/i);
  assert.match(
    migration,
    /insert into public\.user_credits[\s\S]*on conflict \(user_id\) do update/i,
  );
  assert.match(
    migration,
    /insert into public\.credit_transactions[\s\S]*idempotency_key/i,
  );
});

test("Apps in Toss provisioning RPCs are service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.provision_apps_in_toss_tokens_v1[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.provision_apps_in_toss_tokens_v1[\s\S]*to service_role/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.provision_apps_in_toss_pdf_v1[\s\S]*from public, anon, authenticated/i,
  );
});

test("Apps in Toss provisioning validates payment ownership", () => {
  const ownershipChecks =
    migration.match(/PAYMENT_OWNERSHIP_MISMATCH/g)?.length || 0;
  assert.equal(ownershipChecks, 2);
  assert.match(
    migration,
    /from public\.payments[\s\S]*id = p_payment_id[\s\S]*user_id = p_user_id/i,
  );
});
