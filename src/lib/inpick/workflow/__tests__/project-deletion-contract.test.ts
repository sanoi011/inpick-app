import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260724010000_consumer_project_design_output_cascade.sql",
  "utf8",
);

test("project deletion removes legacy orphan outputs and cascades future outputs", () => {
  assert.match(
    migration,
    /delete from public\.design_outputs[\s\S]*not exists[\s\S]*public\.consumer_projects/i,
  );
  assert.match(
    migration,
    /foreign key \(project_id\)[\s\S]*references public\.consumer_projects\(id\)[\s\S]*on delete cascade/i,
  );
});
