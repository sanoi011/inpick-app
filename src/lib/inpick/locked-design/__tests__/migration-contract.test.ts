import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260723010000_locked_design_assets.sql",
);

test("unlock RPC derives identity and serializes credit debit with grant creation", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

  assert.match(sql, /v_actor\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.match(sql, /from\s+public\.user_credits[\s\S]*for update/);
  assert.match(sql, /update\s+public\.user_credits[\s\S]*balance\s*=\s*balance\s*-\s*v_asset\.unlock_cost/);
  assert.match(sql, /insert into public\.credit_transactions/);
  assert.match(sql, /insert into public\.locked_design_access_grants/);
  assert.match(sql, /unique\s*\(user_id,\s*asset_id\)/);
  assert.match(sql, /grant execute on function public\.unlock_locked_design_asset\(uuid, text\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.unlock_locked_design_asset\(uuid, text\) to anon/);
});

test("private render bucket and metadata tables deny direct authenticated reads", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

  assert.match(sql, /'private-design-renders'[\s\S]*false/);
  assert.match(sql, /revoke all on table public\.locked_design_assets from public, anon, authenticated/);
  assert.match(sql, /revoke all on table public\.locked_design_access_grants from public, anon, authenticated/);
  assert.doesNotMatch(sql, /bucket_id\s*=\s*'private-design-renders'[\s\S]{0,200}to authenticated/);
});
