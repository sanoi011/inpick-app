import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const snapshotRoot = path.join(appRoot, "inpick-source");
const manifestPath = path.join(snapshotRoot, "SNAPSHOT.json");
const shouldWrite = process.argv.includes("--write");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const tracked = [
  ...walk(path.join(snapshotRoot, "src")),
  ...walk(path.join(snapshotRoot, "public/mode-cards")),
  path.join(snapshotRoot, "tailwind.config.ts"),
].sort();

const sourceFiles = tracked.map((snapshotFile) => {
  const relative = path.relative(snapshotRoot, snapshotFile);
  const sourceFile = path.join(repoRoot, relative);
  if (!fs.existsSync(sourceFile)) throw new Error(`Missing source file: ${relative}`);
  const snapshotHash = sha256(snapshotFile);
  const sourceHash = sha256(sourceFile);
  if (snapshotHash !== sourceHash) {
    throw new Error(`Snapshot differs from its recorded source: ${relative}`);
  }
  return { path: relative, sha256: snapshotHash };
});

if (shouldWrite) {
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        source: "App Store / Google Play / web shared InPick workflow",
        immutableSnapshot: true,
        sourceFiles,
      },
      null,
      2,
    )}\n`,
  );
}

console.log(`Verified ${sourceFiles.length} isolated InPick source files.`);
