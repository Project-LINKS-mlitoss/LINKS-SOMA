/**
 * MLバイナリビルドスクリプト（ローカル開発用）
 *
 * 用途: macOS / Linux でのローカル開発ビルド
 *
 * 実行:
 *   npm run build              # 全ビルド（IF001, IF002, IF003, IF004, IF005）
 *   npm run build -- IF001     # IF001のみビルド
 *   npm run build -- IF001 IF003  # 複数指定
 *
 * 注意:
 * - CI/CD（GitHub Actions）では別ファイル build.ps1 が使用される
 * - 設定を変更した場合、build.ps1 との同期が必要か検討すること
 * - pyogrio は macOS arm64 で PyInstaller と互換性問題があるため除外
 *   （geopandas は fiona バックエンドで動作する）
 *
 * トラブルシューティング: docs/troubleshooting/ml-build.md
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");

const DIST_DIR = "./dist";
const SRC_DIR = "./src";

// OSに応じてパス区切り文字を設定
const separator = os.platform() === "win32" ? ";" : ":";

// PyInstaller共通設定
const PATHS = `${SRC_DIR}${separator}${SRC_DIR}/E001_DataMatching${separator}${SRC_DIR}/E002_Classification${separator}${SRC_DIR}/E003_Summarization`;
const HIDDEN_IMPORTS = "--hidden-import=E012 --hidden-import=E013 --hidden-import=E014 --hidden-import=E016 --hidden-import=E017 --hidden-import=E022 --hidden-import=E032 --hidden-import=joblib";

// Note: pyogrioはmacOS arm64でPyInstallerと互換性問題があるため除外
// geopandasはfionaバックエンドで動作する
const ALL_TARGETS = {
  IF001: `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all polars --collect-all pyarrow --exclude-module pyogrio ${HIDDEN_IMPORTS} --add-data="src${separator}src" --paths="${PATHS}" --name IF001 ./async_tasks/IF001.py`,

  IF002: `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --collect-all sklearn --collect-all fiona --exclude-module pyogrio ${HIDDEN_IMPORTS} --add-data="async_tasks${separator}async_tasks" --add-data="src${separator}src" --paths="${PATHS}" --name IF002 ./async_tasks/IF002.py`,

  IF003: `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --collect-all sklearn --collect-all fiona --exclude-module pyogrio ${HIDDEN_IMPORTS} --add-data="async_tasks${separator}async_tasks" --add-data="src${separator}src" --paths="${PATHS}" --name IF003 ./async_tasks/IF003.py`,

  IF004: `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all fiona --exclude-module pyogrio ${HIDDEN_IMPORTS} --add-data="async_tasks${separator}async_tasks" --add-data="src${separator}src" --paths="${PATHS}" --name IF004 ./async_tasks/IF004.py`,

  IF005: `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all polars --collect-all pyarrow --exclude-module pyogrio ${HIDDEN_IMPORTS} --add-data="src${separator}src" --paths="${PATHS}" --name IF005 ./async_tasks/IF005.py`,
};

// CLI引数からビルド対象を決定
const args = process.argv.slice(2).map((a) => a.toUpperCase());
const invalidArgs = args.filter((a) => !ALL_TARGETS[a]);
if (invalidArgs.length > 0) {
  console.error(`Unknown target: ${invalidArgs.join(", ")}`);
  console.error(`Available targets: ${Object.keys(ALL_TARGETS).join(", ")}`);
  process.exit(1);
}

const targets = args.length > 0 ? args : Object.keys(ALL_TARGETS);
const isPartialBuild = args.length > 0;

try {
  // 依存関係のインストール（pyproject.tomlの変更に追従）
  console.log("Installing dependencies...");
  execSync("poetry install --no-root", { stdio: "inherit" });

  // ビルドディレクトリの準備
  if (isPartialBuild) {
    // 単体ビルド時はdist/を残し、対象バイナリのみ削除
    fs.mkdirSync(DIST_DIR, { recursive: true });
    for (const target of targets) {
      const binPath = `${DIST_DIR}/${target}`;
      if (fs.existsSync(binPath)) {
        fs.rmSync(binPath);
      }
    }
  } else {
    // 全ビルド時はdist/をクリーン
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  console.log(`Building: ${targets.join(", ")}`);

  // 各コマンドを順次実行
  // NOTE: execSyncのコマンド文字列はすべてハードコードされた定数であり、
  // ユーザー入力は含まれない（CLI引数はALL_TARGETSの辞書キーとの照合のみに使用）
  for (const target of targets) {
    const command = ALL_TARGETS[target];
    console.log(`\n=== ${target} ===`);
    execSync(command, { stdio: "inherit" });
  }
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
