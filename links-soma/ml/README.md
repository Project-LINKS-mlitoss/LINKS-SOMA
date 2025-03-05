# 空き家推定システム バックエンドコード

## 概要

プロジェクト：　「行政情報を活用した空き家データの整備・活用実証調査」

本システムは全国的な空き家急増に対して、空き家実態把握の効率化・簡便化を実現することで、データに基づく迅速かつ効果的な空き家対策の立案・実行を支援できるようになることを目指しています。

## 実行環境

前提環境：Python 3.12.x

- 本システムの実行には、Python言語の実行環境が必要になります。別添の[デモアプリ実行環境構築マニュアル](https://microgeodata.sharepoint.com/:w:/r/sites/ProjectLINKS-ProjectLINKS/Shared%20Documents/LINKS07%20%E8%A1%8C%E6%94%BF%E6%83%85%E5%A0%B1%E3%82%92%E6%B4%BB%E7%94%A8%E3%81%97%E3%81%9F%E7%A9%BA%E3%81%8D%E5%AE%B6%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AE%E6%95%B4%E5%82%99%E3%83%BB%E6%B4%BB%E7%94%A8%E5%AE%9F%E8%A8%BC%E8%AA%BF%E6%9F%BB/80_%E4%B8%AD%E9%96%93%E7%B4%8D%E5%93%81/%E3%83%90%E3%83%83%E3%82%AF%E3%82%A8%E3%83%B3%E3%83%89%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E4%BC%9A%E8%B3%87%E6%96%99/%E3%83%86%E3%82%99%E3%83%A2%E3%82%A2%E3%83%95%E3%82%9A%E3%83%AA%E5%AE%9F%E8%A1%8C%E7%92%B0%E5%A2%83%E6%A7%8B%E7%AF%89%E3%83%9E%E3%83%8B%E3%83%A5%E3%82%A2%E3%83%AB.docx?d=w3417f162b6994cb79d07d1122c4b81ba&csf=1&web=1&e=4zKI8v)をご参照ください。

### （任意）仮想環境の設定

この先の設定は任意ですが、設定を行うことですでに手元のPC上に入っているPythonの環境に不要な依存ライブラリ等を導入することなく利用できます.

#### ①開発用環境を作成

以下コマンドのいずれかを実行し開発用の環境を作成します.

```
python -m venv .venv
```

もしくは

```
python3 -m venv .venv
```

#### ②開発用環境を利用する

上記だけでは, 環境が作成されるだけで利用できないため利用するための設置を行います.
環境ごとにいずれかのコマンドを実行してください

> Linux / Unix / macOS

```
source .venv/bin/activate
```

> Windows

```
.venv/Scripts/activate
```

#### ③依存ライブラリのインストール

上記利用設定後, 開発に必要なライブラリのインストールを行います.
以下のコマンドのいずれかを実行してください.

```
pip install -r requirements.txt
```

もしくは

```
pip3 install -r requirements.txt
```

### Poetryを使う場合

#### Poetryのインストール

PoetryはPythonの依存関係管理ツールです。以下のコマンドを実行してPoetryをインストールします。

```
curl -sSL https://install.python-poetry.org | python3 -
```

もしくは

```
curl -sSL https://install.python-poetry.org | python -
```

インストールが完了したら、以下のコマンドでPoetryが正しくインストールされたか確認します。

```
poetry --version
```

#### 依存ライブラリのインストール

Poetryを使って依存ライブラリをインストールするには、以下のコマンドを実行します。

```
cd ml
poetry install
```

これにより、`pyproject.toml`ファイルに記載された依存関係がインストールされます。

#### Pyinstallerの実行

```
poetry run pyinstaller --onefile --clean ./src/{your file}.py
```

or

```
./build.sh
```

```
./dist/{your file}
```

実行例

<details>
<summary>実行例</summary>

```


- IF001:
  ./dist/IF001 --parameters '{\"output_path\": \"C:/source_code/links-akiya/ml/dist/\", \"database_path\": \"C:/source_code/links-akiya/ml/database.db\", \"settings\": {\"reference_date\": \"2023-03-20\", \"advanced\": {\"n_gram_size\": \"1\", \"similarity_threshold\": \"0.95\", \"joining_method\": \"intersection\"}}, \"data\": {\"resident_registry\": {\"path\": \"C:/23211/E012/inputs/juki_2023.csv\", \"columns\": {\"household_code\": \"世帯コード\", \"birthdate\": \"生年月日\", \"gender\": \"性別\", \"resident_date\": \"住定異動年月日\", \"address\": \"住所\"}}, \"water_status\": {\"path\": \"C:/23211/E012/inputs/suido_status_2023.csv\", \"columns\": {\"water_disconnection_flag\": \"開閉栓区分\", \"water_disconnection_date\": \"使用中止日\", \"water_supply_number\": \"水道番号\", \"water_connection_flag\": \"使用開始日\", \"address\": \"設置場所\"}},\"buidling_polygon\": {\"path\": \"C:/23211/E016/inputs/toyota_lod0_attributes.csv\", \"columns\": {\"building_id\": \"buildingID\"}}, \"water_supply_usage\": {\"path\": \"C:/23211/E012/inputs/suido_use_2023.csv\", \"columns\": {\"water_supply_number\": \"水道番号\", \"water_usage\": \"使用水量\", \"water_recorded_date\": \"検針年月日\"}}, \"land_registry\": {\"path\": \"C:/23211/E012/inputs/touki.csv\", \"columns\": {\"address\": \"住所\", \"structure_name\": \"登記構造\", \"registration_date\": \"登記日付\"}}, \"vacant_house\": {\"path\": \"C:/23211/E012/inputs/akiya_result.csv\", \"columns\": {\"vacant_house_id\": \"ID\", \"address\": \"住所\", \"latitude\": \"経度\", \"longitude\": \"緯度\"}}, \"geocoding\": {\"path\": \"C:/23211/E012/inputs/geocoding.csv\"}, \"census\": {\"path\": \"C:/23211/E016/inputs/r2ka23.gpkg\"}}}'
- IF002:
  ./dist/IF002 --parameters '{\"input_path\": \"C:/23211/E021/inputs/D901.csv\", \"database_path\": \"C:/source_code/links-akiya/ml/database.db\", \"test_size\": 0.3, \"n_splits\": 3, \"undersample\": \"\", \"undersample_ratio\": 3.0, \"threshold\": 0.3, \"hyperparameter_flag\": \"\", \"n_trials\": 100, \"lambda_l1\": 0, \"lambda_l2\": 0, \"num_leaves\": 31, \"feature_fraction\": 1.0, \"bagging_fraction\": 1.0, \"bagging_freq\": 0, \"min_data_in_leaf\": 20, \"output_path\": \"C:/source_code/links-akiya/ml/dist/\"}'
- IF003:
  ./dist/IF003 --parameters '{\"output_path\": \"C:/source_code/links-akiya/ml/dist/\", \"dataset_path\": \"C:/source_code/links-akiya/ml/database.db\", \"threshold\": \"0.3\", \"area_grouping\": { \"path\": \"C:/23211/E022/inputs/D902.csv\"}, \"model_path\": \"C:/23211/E022/inputs/models.zip\", \"spatial_file\": \"C:/23211/E016/inputs/r2ka23.gpkg\" }'
- IF004:
  ./dist/IF004 --parameters '{\"output_path\": \"C:/source_code/links-akiya/ml/dist/\", \"dataset_path\": \"C:/source_code/links-akiya/ml/database.db\", \"input_file\": \"C:/path/833817ba-6dc9-4f64-999b-18f13beb1d93.csv\", \"ouput_file_type\": \"csv\", \"output_coordinate\": \"4326\" }'
```

</details>

## ファイル構成

- ソースコードはsrcフォルダとGradioフォルダの2種類に分かれています。
  - srcフォルダ: 本システムの各機能の処理が記載されたコードとなります。引数を指定して実行します。最終的に本ファイルをコンパイルし、Exeファイル化して実行します。
  - Gradioフォルダ：　srcフォルダのコードをライブラリとして読み込み、Gradioという簡易デモインターフェース上でGUI上で動作確認することができます。

## 実行方法

- ターミナル上で各処理のディレクトリに入り、該当ディレクトリでpythonを実行します。

### Gradio（デモ環境）を実行する方法

E012を実行する場合

```
cd ./Gradio/E001_DataMatching
python E012.py
```

Gradioではデモ用とデバッグ用の２種類のコードを用意しています。

Ex. E012の場合

- デモ用：　E012.py
- ファイルのドラッグ&ドロップ、メニュー選択等を行って、アップされたデータに応じて適切な項目を選択・実行していきます。
- デバッグ用：　E012_debug.py
- 試行錯誤をすぐに行えるように、あらかじめファイルパスやオプションが入力され、実行するだけの状態となっています。あらかじめる読み込まれるファイルパスは以下の構成となっています。

豊橋市（23201）の場合

```
./Gradio/E001_DataMatching/23201
├── E012
│   ├── inputs # 入力データをこちらにセットしてください。
│   │   ├── akiya_result.csv
│   │   ├── geocoding.csv
│   │   ├── juki_2023.csv #年度ごとに用意してください
│   │   ├── touki.csv
│   │   ├── suido_use_2023.csv #年度ごとに用意してください
│   │   └── suido_status_2023.csv #年度ごとに用意してください
│   └── outputs
├── E013
│   ├── inputs
│   └── outputs
├── E014
│   ├── inputs
│   └── outputs
├── E015
│   ├── inputs
│   └── outputs
└── E016
    ├── inputs
    └── outputs
```
