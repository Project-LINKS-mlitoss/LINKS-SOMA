const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");

const DIST_DIR = "./dist";
const SRC_DIR = "./src";

try {
  // ビルドディレクトリのクリーニング
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // OSに応じてパス区切り文字を設定
  const separator = os.platform() === "win32" ? ";" : ":";

  // PyInstallerコマンドの実行
  const commands = [
    `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all pyogrio --collect-all shapely --add-data="src${separator}src" --paths="${SRC_DIR}" --name IF001 ./async_tasks/IF001.py`,

    `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all imblearn --collect-all memory_profiler --collect-all chardet --collect-all pandas --collect-all sklearn --collect-all lightgbm --collect-all numpy --collect-all optuna --collect-all seaborn --collect-all japanize_matplotlib --add-data="src${separator}src" --paths="${SRC_DIR}" --name IF002 ./async_tasks/IF002.py`,

    `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --add-data="async_tasks${separator}async_tasks" --add-data="src${separator}src" --paths="${SRC_DIR}" --name IF003 ./async_tasks/IF003.py`,

    `poetry run pyinstaller --onefile --distpath ${DIST_DIR} --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all fiona --add-data="async_tasks${separator}async_tasks" --add-data="src${separator}src" --paths="${SRC_DIR}" --name IF004 ./async_tasks/IF004.py`,
  ];

  // 各コマンドを順次実行
  commands.forEach((command) => {
    console.log(`Executing: ${command}`);
    execSync(command, { stdio: "inherit" });
  });
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
