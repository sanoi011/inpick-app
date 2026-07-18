import assert from "node:assert/strict";
import test from "node:test";
import {
  FloorplanDeadlineError,
  withFloorplanDeadline,
} from "../deadline";

test("완료된 작업 값을 그대로 반환한다", async () => {
  assert.equal(await withFloorplanDeadline(Promise.resolve("ok"), 100, "storage"), "ok");
});

test("멈춘 SDK 작업을 제한시간에 종료한다", async () => {
  await assert.rejects(
    withFloorplanDeadline(new Promise<never>(() => undefined), 20, "storage"),
    (error: unknown) =>
      error instanceof FloorplanDeadlineError && error.operation === "storage",
  );
});
