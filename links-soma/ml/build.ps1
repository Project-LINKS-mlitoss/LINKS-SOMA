<#
.SYNOPSIS
    MLバイナリビルドスクリプト（CI/CD用）

.DESCRIPTION
    用途: Windows / GitHub Actions でのCI/CDビルド
    実行: .github/workflows/build.yml から呼び出し

.NOTES
    - ローカル開発（macOS/Linux）では別ファイル build.js が使用される
    - 設定を変更した場合、build.js との同期が必要か検討すること
    - Windows では pyogrio の互換性問題がないため除外していない

    トラブルシューティング: docs/troubleshooting/ml-build.md
#>

# Building IF001
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all pyogrio --collect-all shapely --collect-all polars --collect-all pyarrow --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF001 ./async_tasks/IF001.py

# Building IF002
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --collect-all sklearn --collect-all fiona --collect-all pyogrio --hidden-import=joblib --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF002 ./async_tasks/IF002.py

# Building IF003
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --collect-all sklearn --collect-all fiona --collect-all pyogrio --hidden-import=joblib --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF003 ./async_tasks/IF003.py

# Building IF004
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all fiona --collect-all pyogrio --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF004 ./async_tasks/IF004.py

# Building IF005
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all pyogrio --collect-all shapely --collect-all polars --collect-all pyarrow --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF005 ./async_tasks/IF005.py

Write-Host "Build process completed." 