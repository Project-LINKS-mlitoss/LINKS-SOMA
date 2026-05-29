/**
 * E2Eテスト・操作スクリプトの一覧を表示するヘルパー
 *
 * 使い方:
 *   node scripts/list-tests.js e2e     # E2Eテスト一覧
 *   node scripts/list-tests.js script  # 操作スクリプト一覧
 */

const fs = require("fs");
const path = require("path");

const type = process.argv[2];
const testsDir = path.join(__dirname, "..", "src", "tests");

/**
 * ディレクトリを再帰的に走査して条件に合うファイルを収集する
 */
function collectFiles(dir, filter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, filter));
    } else if (filter(entry.name)) {
      // ディレクトリからの相対パスを含めて表示
      const relative = path.relative(dir, fullPath);
      results.push(relative);
    }
  }
  return results;
}

if (type === "e2e") {
  const e2eDir = path.join(testsDir, "e2e");
  const screens = collectFiles(
    path.join(e2eDir, "screens"),
    (f) => f.endsWith(".e2e.ts"),
  ).map((f) => `screens/${f.replace(".e2e.ts", "")}`);
  const flows = collectFiles(
    path.join(e2eDir, "flows"),
    (f) => f.endsWith(".e2e.ts"),
  ).map((f) => `flows/${f.replace(".e2e.ts", "")}`);

  console.log("利用可能なE2Eテスト:");
  if (screens.length > 0) {
    console.log("\n  [screens]");
    screens.sort().forEach((f) => console.log(`    ${f}`));
  }
  if (flows.length > 0) {
    console.log("\n  [flows]");
    flows.sort().forEach((f) => console.log(`    ${f}`));
  }
  console.log("\n使い方: npm run e2e -- <フィルタ名>");
  console.log("例:     npm run e2e -- wizard");
  console.log("        npm run e2e:built -- wizard  (ビルド済みモード)");
} else if (type === "script") {
  const scriptsDir = path.join(testsDir, "scripts");
  const files = collectFiles(scriptsDir, (f) => f.endsWith(".ts"))
    .map((f) => f.replace(".ts", ""))
    .sort();

  console.log("利用可能な操作スクリプト:");
  files.forEach((f) => console.log(`  ${f}`));
  console.log("\n使い方: npm run script -- <フィルタ名>");
  console.log("例:     npm run script -- draft");
  console.log("        npm run script:built -- draft  (ビルド済みモード)");
} else {
  console.log("使い方: node scripts/list-tests.js <e2e|script>");
  process.exit(1);
}
