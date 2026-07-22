import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/contractor/login/route.ts"),
  "utf8",
);

test("사업자 이메일 로그인은 저장된 password_hash를 조회하고 검증한다", () => {
  assert.match(source, /password_hash/);
  assert.match(source, /verifyPassword\(password,\s*row\.password_hash\)/);
});

test("미등록 이메일을 로그인 과정에서 자동 생성하지 않는다", () => {
  assert.doesNotMatch(source, /\.from\("specialty_contractors"\)[\s\S]*?\.insert\(/);
  assert.match(source, /가입 페이지/);
});

test("password_hash 없는 legacy 계정은 재설정을 요구한다", () => {
  assert.match(source, /비밀번호 재설정/);
  assert.match(source, /status:\s*403/);
});
