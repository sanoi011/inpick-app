/**
 * Curate InPick style LoRA training dataset — Phase 8.
 *
 * 가이드: c:\Users\user\Downloads\inpick-claude-code-dev-direction-20260510.md
 *        Prompt 8 (Style LoRA 데이터 큐레이션)
 *        §8 (InPick LoRA 학습 방향)
 *
 * 목적:
 *   - license-ledger.jsonl을 읽어서 training 자격이 있는 항목만 export
 *   - LoRA fine-tune toolkit 호환 폴더 구조 생성:
 *
 *     data/inpick-style/
 *       train/
 *         <hash>.jpg
 *         <hash>.txt    ← caption (LoRA tags)
 *       validation/
 *         <hash>.jpg
 *         <hash>.txt
 *       MANIFEST.jsonl  ← 학습 매핑 + license 메타
 *
 * 자격 조건 (모두 만족):
 *   - allowsCommercialUse = true
 *   - allowsModelTraining = true
 *   - source ∈ {owned, partner, stock_paid, synthetic, public_dataset}
 *   - verification = "verified"
 *   - caption 비어있지 않음
 *
 * 사용:
 *   npx tsx scripts/curate-inpick-style-dataset.ts \
 *     --ledger data/inpick-style/license-ledger.jsonl \
 *     --out   data/inpick-style \
 *     --validationRatio 0.1
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface LedgerEntry {
  fileHash: string;
  filePath: string;
  source: string;
  license?: string;
  rightsHolder?: string;
  allowsCommercialUse: boolean;
  allowsModelTraining: boolean;
  caption?: string;
  meta?: Record<string, unknown>;
  verification?: string;
}

const ALLOWED_SOURCES = new Set([
  "owned",
  "partner",
  "stock_paid",
  "synthetic",
  "public_dataset",
]);

function isEligible(e: LedgerEntry): { ok: boolean; reason?: string } {
  if (!e.allowsCommercialUse) return { ok: false, reason: "no commercial" };
  if (!e.allowsModelTraining) return { ok: false, reason: "no training" };
  if (!ALLOWED_SOURCES.has(e.source))
    return { ok: false, reason: `source=${e.source}` };
  if (e.verification !== "verified")
    return { ok: false, reason: `verification=${e.verification}` };
  if (!e.caption || e.caption.trim().length < 10)
    return { ok: false, reason: "caption missing or too short" };
  if (!fs.existsSync(e.filePath))
    return { ok: false, reason: `file not found: ${e.filePath}` };
  return { ok: true };
}

function loadLedger(p: string): LedgerEntry[] {
  if (!fs.existsSync(p)) {
    console.error(`[curate] ledger 없음: ${p}`);
    console.error(
      `먼저: npx tsx scripts/create-data-license-ledger.ts --template ${p}`,
    );
    process.exit(1);
  }
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as LedgerEntry);
}

function copyImage(src: string, dst: string) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function writeCaption(dst: string, caption: string) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, caption.trim() + "\n", "utf8");
}

interface CurateArgs {
  ledger: string;
  out: string;
  validationRatio: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CurateArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return {
    ledger: args.ledger || "data/inpick-style/license-ledger.jsonl",
    out: args.out || "data/inpick-style",
    validationRatio: parseFloat(args.validationRatio || "0.1"),
    dryRun: args.dry === "true",
  };
}

function curate(opts: CurateArgs) {
  const ledger = loadLedger(opts.ledger);
  console.log(`[curate] ledger entries: ${ledger.length}`);

  // 자격 검증
  const eligible: LedgerEntry[] = [];
  const rejected: { entry: LedgerEntry; reason: string }[] = [];
  for (const e of ledger) {
    const r = isEligible(e);
    if (r.ok) eligible.push(e);
    else rejected.push({ entry: e, reason: r.reason || "unknown" });
  }

  console.log(`[curate] eligible: ${eligible.length}`);
  console.log(`[curate] rejected: ${rejected.length}`);
  if (rejected.length > 0) {
    const reasonCount: Record<string, number> = {};
    for (const r of rejected) {
      reasonCount[r.reason] = (reasonCount[r.reason] || 0) + 1;
    }
    for (const [k, v] of Object.entries(reasonCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${k}: ${v}`);
    }
  }

  if (eligible.length === 0) {
    console.log(
      "[curate] 자격 통과한 entry 0건 — ledger를 사람이 검증한 뒤 다시 실행",
    );
    return;
  }

  // train/validation 분할 (deterministic by hash)
  eligible.sort((a, b) => a.fileHash.localeCompare(b.fileHash));
  const valCount = Math.max(1, Math.floor(eligible.length * opts.validationRatio));
  const validation = eligible.slice(0, valCount);
  const train = eligible.slice(valCount);

  console.log(
    `[curate] split: train=${train.length} validation=${validation.length}`,
  );

  if (opts.dryRun) {
    console.log("[curate] DRY RUN — files not copied");
    return;
  }

  // 디렉토리 생성
  const trainDir = path.join(opts.out, "train");
  const valDir = path.join(opts.out, "validation");
  fs.mkdirSync(trainDir, { recursive: true });
  fs.mkdirSync(valDir, { recursive: true });

  // 매니페스트
  const manifestPath = path.join(opts.out, "MANIFEST.jsonl");
  fs.writeFileSync(manifestPath, "", "utf8");

  let nTrain = 0;
  let nVal = 0;
  for (const [batch, dir, isVal] of [
    [train, trainDir, false] as const,
    [validation, valDir, true] as const,
  ]) {
    for (const e of batch) {
      const ext = path.extname(e.filePath) || ".jpg";
      const baseName = e.fileHash.slice(0, 16);
      const dstImage = path.join(dir, `${baseName}${ext}`);
      const dstCap = path.join(dir, `${baseName}.txt`);

      copyImage(e.filePath, dstImage);
      writeCaption(dstCap, e.caption || "");

      const manifestRow = {
        baseName,
        split: isVal ? "validation" : "train",
        image: path.relative(opts.out, dstImage).replace(/\\/g, "/"),
        caption: path.relative(opts.out, dstCap).replace(/\\/g, "/"),
        captionText: e.caption,
        source: e.source,
        license: e.license,
        rightsHolder: e.rightsHolder,
        meta: e.meta,
        originalPath: e.filePath,
        fileHash: e.fileHash,
      };
      fs.appendFileSync(manifestPath, JSON.stringify(manifestRow) + "\n", "utf8");
      if (isVal) nVal++;
      else nTrain++;
    }
  }

  console.log(`[curate] copied train=${nTrain} validation=${nVal}`);
  console.log(`[curate] manifest: ${manifestPath}`);
  console.log(`[curate] training set ready at: ${opts.out}`);
  console.log(
    `[curate] 다음: docs/inpick-image-generation/MODEL_AND_DATA_POLICY.md 의 LoRA 학습 체크리스트 통과 후 학습 진행`,
  );
}

const opts = parseArgs(process.argv.slice(2));
console.log(`[curate] ledger=${opts.ledger}`);
console.log(`[curate] out=${opts.out}`);
console.log(`[curate] validationRatio=${opts.validationRatio}`);
curate(opts);
