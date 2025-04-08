# Script to build executables using PyInstaller with Poetry

# Building IF001
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all numpy --collect-all fiona --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all pyogrio --collect-all shapely --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF001 ./async_tasks/IF001.py

# Building IF002
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all imblearn --collect-all memory_profiler --collect-all chardet --collect-all pandas --collect-all sklearn --collect-all lightgbm --collect-all numpy --collect-all optuna --collect-all seaborn --add-data "src:src" --paths="./src" --name IF002 ./async_tasks/IF002.py

# Building IF003
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all lightgbm --collect-all numpy --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF003 ./async_tasks/IF003.py

# Building IF004
poetry run pyinstaller --onefile --noconsole --distpath ./dist --collect-all chardet --collect-all pandas --collect-all geopandas --collect-all shapely --collect-all fiona --add-data "async_tasks:async_tasks" --add-data "src:src" --paths="./src" --name IF004 ./async_tasks/IF004.py

Write-Host "Build process completed." 