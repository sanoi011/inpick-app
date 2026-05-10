/**
 * Data License Ledger — Phase 8.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
 *        Prompt 8 (Style LoRA 데이터 큐레이션 준비)
 *        §8-2 (데이터 정책)
 *        §8-3 (데이터 ledger 스키마)
 *
 * 목적:
 *   - 모든 LoRA 학습 후보 이미지의 license 메타데이터를 단일 ledger에 기록
 *   - allowsCommercialUse + allowsModelTraining 둘 다 true인 것만 training set 진입
 *   - unknown은 절대 training set에 넣지 않음 (가이드 명시)
 *
 * 사용:
 *   # 1. 신규 ledger 생성 (스캔)
 *   npx tsx scripts/create-data-license-ledger.ts \
 *     --scan data/inpick-style-raw \
 *     --out data/inpick-style/license-ledger.jsonl
 *
 *   # 2. 통계 출력
 *   npx tsx scripts/create-data-license-ledger.ts \
 *     --stats data/inpick-style/license-ledger.jsonl
 *
 *   # 3. 빈 ledger 템플릿
 *   npx tsx scripts/create-data-license-ledger.ts \
 *     --template data/inpick-style/license-ledger.jsonl
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ─── 타입 ───
type LicenseSource =
  | "owned" // 직접 촬영/제작
  | "partner" // 파트너/고객 명시 동의
  | "stock_paid" // 계약된 유료 스톡
  | "synthetic" // 자체 3D 렌더
  | "public_dataset" // AI 학습/상업 사용 허용 공공 데이터
  | "external" // ❌ Pinterest, 인스타, 블로그, 출처만 표기 — training 금지
  | "unknown"; // ❌ 미확인 — training 금지

interface LedgerEntry {
  /** SHA256 (파일 본문 기반 — 중복 체크 + audit) */
  fileHash: string;
  /** 원본 경로 (상대 — repo root 기준) */
  filePath: string;
  /** 원본 파일명 (이력) */
  originalName?: string;
  /** ledger 생성/갱신 시각 */
  recordedAt: string;
  /** 출처 분류 */
  source: LicenseSource;
  /** 라이선스 명 (예: "CC-BY-4.0", "MIT", "OpenAI ToS", "Direct Capture", "Unsplash"...) */
  license?: string;
  /** 권리자/제공자 */
  rightsHolder?: string;
  /** 출처 URL/계약 문서 ref */
  sourceRef?: string;
  /** 상업 사용 허용 (확인된 경우만 true — 의심이면 false) */
  allowsCommercialUse: boolean;
  /** AI 학습/모델 훈련 사용 허용 — 명시 동의/계약/라이선스 명문화된 경우만 true */
  allowsModelTraining: boolean;
  /** caption (LoRA 학습용) — 가이드 §8 정책 */
  caption?: string;
  /** caption 메타 (구조화) */
  meta?: {
    roomType?: string; // 거실 / 안방 / 주방 / 욕실 등
    material?: string; // 화이트 / 우드 / 그레이 톤 / 마감
    lighting?: string; // natural daylight / warm lamp / mixed
    style?: string; // 한국 아파트 / 모던 / 미니멀
    furnitureDensity?: "low" | "medium" | "high";
    // 학습 시 부정 단서 (negative prompt 또는 학습 제외용)
    excludeReason?: string;
  };
  /** 검증 상태 */
  verification?: "pending" | "verified" | "rejected";
  /** 검증자 (담당자 ID/이름) */
  verifiedBy?: string;
  verifiedAt?: string;
  /** 비고 */
  notes?: string;
}

// ─── 헬퍼 ───
function hashFile(filePath: string): string {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
}

function* walkDir(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkDir(full);
    else if (e.isFile() && isImageFile(full)) yield full;
  }
}

function loadLedger(p: string): LedgerEntry[] {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LedgerEntry);
}

function appendLedger(p: string, entry: LedgerEntry) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(entry) + "\n", "utf8");
}

// ─── 액션 ───
function scanDirectory(scanDir: string, outPath: string) {
  const existing = loadLedger(outPath);
  const knownHashes = new Set(existing.map((e) => e.fileHash));
  let added = 0;
  let skipped = 0;
  for (const filePath of walkDir(scanDir)) {
    const hash = hashFile(filePath);
    if (knownHashes.has(hash)) {
      skipped++;
      continue;
    }
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
    const entry: LedgerEntry = {
      fileHash: hash,
      filePath: rel,
      originalName: path.basename(filePath),
      recordedAt: new Date().toISOString(),
      // 기본값은 unknown — 사람이 검증해야 source/license 채움
      source: "unknown",
      allowsCommercialUse: false,
      allowsModelTraining: false,
      verification: "pending",
      notes:
        "AUTOMATIC SCAN — source/license/permissions를 사람이 채워야 training set 진입 가능",
    };
    appendLedger(outPath, entry);
    knownHashes.add(hash);
    added++;
  }
  console.log(`[ledger] scanned ${scanDir} → +${added} new (skipped ${skipped} dup)`);
  console.log(`[ledger] output: ${outPath}`);
  console.log(
    `[ledger] 다음: 각 entry의 source/license/allows*/caption 등을 사람이 채워라.`,
  );
}

function showStats(ledgerPath: string) {
  const entries = loadLedger(ledgerPath);
  if (entries.length === 0) {
    console.log("[ledger] empty");
    return;
  }
  const bySource: Record<string, number> = {};
  let trainingEligible = 0;
  let pending = 0;
  let verified = 0;
  let rejected = 0;
  for (const e of entries) {
    bySource[e.source] = (bySource[e.source] || 0) + 1;
    if (e.allowsCommercialUse && e.allowsModelTraining) trainingEligible++;
    if (e.verification === "pending") pending++;
    if (e.verification === "verified") verified++;
    if (e.verification === "rejected") rejected++;
  }
  console.log(`[ledger] total entries: ${entries.length}`);
  console.log(`[ledger] training eligible (commercial+training=true): ${trainingEligible}`);
  console.log(`[ledger] verification: pending=${pending} verified=${verified} rejected=${rejected}`);
  console.log(`[ledger] by source:`);
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    const ok =
      k === "owned" || k === "partner" || k === "stock_paid" || k === "synthetic"
        ? "✓"
        : k === "public_dataset"
          ? "?"
          : "✗";
    console.log(`  ${ok} ${k.padEnd(16)} ${v}`);
  }
}

function writeTemplate(outPath: string) {
  const samples: LedgerEntry[] = [
    {
      fileHash: "<sha256 — auto from file>",
      filePath: "data/inpick-style-raw/owned/living-001.jpg",
      originalName: "living-001.jpg",
      recordedAt: new Date().toISOString(),
      source: "owned",
      license: "Direct Capture (InPick Inc.)",
      rightsHolder: "InPick",
      allowsCommercialUse: true,
      allowsModelTraining: true,
      caption:
        "korean apartment living room, white walls, warm oak floor, large south-facing window, low furniture density, natural daylight",
      meta: {
        roomType: "거실",
        material: "white wall + oak floor",
        lighting: "natural daylight",
        style: "Korean apartment minimal",
        furnitureDensity: "low",
      },
      verification: "verified",
      verifiedBy: "kim.sb",
      verifiedAt: new Date().toISOString(),
    },
    {
      fileHash: "<sha256>",
      filePath: "data/inpick-style-raw/partner/sample-living.jpg",
      source: "partner",
      license: "Custom partner agreement (2026-04 contract #C-042)",
      rightsHolder: "Partner Studio",
      sourceRef: "contracts/C-042-2026-04.pdf",
      allowsCommercialUse: true,
      allowsModelTraining: true,
      caption: "korean modern apartment kitchen, dark stone counter, oak cabinet",
      meta: {
        roomType: "주방",
        material: "dark stone + oak",
        lighting: "warm lamp",
        style: "modern Korean",
        furnitureDensity: "medium",
      },
      verification: "verified",
      recordedAt: new Date().toISOString(),
    },
    {
      fileHash: "<sha256>",
      filePath: "data/inpick-style-raw/external/pinterest-pin-XXX.jpg",
      source: "external",
      license: "Unknown (Pinterest)",
      allowsCommercialUse: false,
      allowsModelTraining: false,
      verification: "rejected",
      notes: "EXCLUDED — Pinterest 출처 (가이드 §8-2 금지)",
      recordedAt: new Date().toISOString(),
    },
  ];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    samples.map((s) => JSON.stringify(s)).join("\n") + "\n",
    "utf8",
  );
  console.log(`[ledger] template written to ${outPath}`);
}

// ─── CLI ───
function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.template) {
  writeTemplate(args.template);
  process.exit(0);
}
if (args.stats) {
  showStats(args.stats);
  process.exit(0);
}
if (args.scan && args.out) {
  scanDirectory(args.scan, args.out);
  process.exit(0);
}

console.log("Usage:");
console.log("  --scan <dir> --out <ledger.jsonl>      디렉토리 스캔 → ledger 추가 (source=unknown 으로 시작)");
console.log("  --stats <ledger.jsonl>                  통계 출력");
console.log("  --template <ledger.jsonl>               샘플 작성");
process.exit(1);
