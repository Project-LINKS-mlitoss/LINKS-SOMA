/* eslint-disable no-console -- CLIスクリプトのため標準出力を使用 */
/**
 * IPC チャンネル検証スクリプト
 *
 * ADR-0011 ディレクトリ垂直スライス化の前提条件2として、
 * ipcMainListeners のチャンネルキー一覧をスナップショット取得・比較検証する。
 *
 * 使い方:
 *   npx tsx scripts/verify-ipc-channels.ts snapshot   # スナップショット取得
 *   npx tsx scripts/verify-ipc-channels.ts verify     # スナップショットと比較検証
 */

import fs from "fs";
import path from "path";
import { Project, SyntaxKind } from "ts-morph";

const IPC_INDEX_PATH = path.resolve(
  __dirname,
  "../src/ipc-main-listeners/index.ts",
);
const SNAPSHOT_PATH = path.resolve(__dirname, "../ipc-channels-snapshot.json");

/** ipc-main-listeners/index.ts から ipcMainListeners のキー一覧を抽出 */
function extractChannelKeys(): string[] {
  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, "../tsconfig.base.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const sourceFile = project.addSourceFileAtPath(IPC_INDEX_PATH);

  // `export const ipcMainListeners = { ... }` を探す
  const declaration = sourceFile.getVariableDeclaration("ipcMainListeners");
  if (!declaration) {
    throw new Error("ipcMainListeners が見つかりません: " + IPC_INDEX_PATH);
  }

  const initializer = declaration.getInitializer();
  if (!initializer || !initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
    throw new Error(
      "ipcMainListeners の初期化子がオブジェクトリテラルではありません",
    );
  }

  const keys: string[] = [];

  for (const prop of initializer.getProperties()) {
    if (prop.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
      // `selectWorkbooks,` → キー名 = 変数名
      keys.push(prop.getName());
    } else if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      // `appInfo: appInfoHandler,` → キー名 = "appInfo"
      keys.push(prop.getName());
    } else if (prop.isKind(SyntaxKind.SpreadAssignment)) {
      // `...datasetHandlers` → 警告を出して手動確認を促す
      const expression = prop.getExpression().getText();
      console.warn(
        `⚠ スプレッド構文を検出: ...${expression}` +
          "\n  スプレッド元のキーは自動解決されません。手動で確認してください。",
      );
    }
  }

  return keys.sort();
}

/** スナップショットをJSONファイルに保存 */
function saveSnapshot(keys: string[]): void {
  const data = {
    generatedAt: new Date().toISOString(),
    source: "app/src/ipc-main-listeners/index.ts",
    channelCount: keys.length,
    channels: keys,
  };

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ スナップショットを保存しました: ${SNAPSHOT_PATH}`);
  console.log(`  チャンネル数: ${keys.length}`);
}

/** スナップショットと現在のキーを比較検証 */
function verify(currentKeys: string[]): boolean {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(
      "✗ スナップショットが見つかりません。先に snapshot コマンドを実行してください。",
    );
    return false;
  }

  const rawSnapshot: unknown = JSON.parse(
    fs.readFileSync(SNAPSHOT_PATH, "utf-8"),
  );
  if (
    !rawSnapshot ||
    typeof rawSnapshot !== "object" ||
    !("channels" in rawSnapshot) ||
    !Array.isArray((rawSnapshot as { channels: unknown }).channels)
  ) {
    console.error(
      "✗ スナップショットの形式が不正です（channels配列が見つかりません）",
    );
    return false;
  }
  const snapshot = rawSnapshot as { channels: string[]; channelCount: number };
  const snapshotKeys = new Set(snapshot.channels);
  const currentSet = new Set(currentKeys);

  const missing = snapshot.channels.filter((k) => !currentSet.has(k));
  const added = currentKeys.filter((k) => !snapshotKeys.has(k));

  console.log(`スナップショット: ${snapshot.channelCount} チャンネル`);
  console.log(`現在:             ${currentKeys.length} チャンネル`);
  console.log();

  if (missing.length === 0 && added.length === 0) {
    console.log("✓ 全チャンネルが一致しています。登録漏れはありません。");
    return true;
  }

  let hasError = false;

  if (missing.length > 0) {
    hasError = true;
    console.error(`✗ 欠落チャンネル (${missing.length}件):`);
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
  }

  if (added.length > 0) {
    console.log(`+ 新規チャンネル (${added.length}件):`);
    for (const key of added) {
      console.log(`  + ${key}`);
    }
  }

  return !hasError;
}

// --- メイン ---
const command = process.argv[2];

if (command !== "snapshot" && command !== "verify") {
  console.log("使い方:");
  console.log(
    "  npx tsx scripts/verify-ipc-channels.ts snapshot  # スナップショット取得",
  );
  console.log("  npx tsx scripts/verify-ipc-channels.ts verify    # 比較検証");
  process.exit(1);
}

const keys = extractChannelKeys();

if (command === "snapshot") {
  saveSnapshot(keys);
} else {
  const ok = verify(keys);
  if (!ok) {
    process.exit(1);
  }
}
/* eslint-enable no-console -- CLIスクリプトのため標準出力を使用 */
