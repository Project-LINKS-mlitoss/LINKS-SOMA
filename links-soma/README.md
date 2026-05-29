# LINKS SOMA（リンクス ソーマ）- 空き家推定システム

LINKS SOMAは、国土交通省総合政策局情報政策課が開発した、行政データと機械学習技術を活用した地域空き家推定システムです。地方自治体における空き家対策業務の効率化を支援することを目的としています。

## プロジェクト概要

### 主な特徴

- 機械学習による空き家推定モデルの構築
- 多様なデータの統合・可視化（地図、グラフ、表）
- 国土地理院地図タイルを使用した高精度な地図表示
- BIツール機能による分析結果の多角的な表示
- オフライン環境での動作に対応
- プリセットモデルの初回起動時自動登録

### 対象ユーザー

- **地方自治体**: 空き家実態調査の効率化、空き家対策計画の策定
- **開発者**: 機能追加、保守、カスタマイズ
- **プロダクトマネージャー**: プロジェクト管理、ビルド・配布

## システムアーキテクチャ

LINKS SOMAは **Electron + Python統合システム** として設計されています。

```
┌─────────────────────────────────────────┐
│ Electronアプリ（フロントエンド）        │
│ ┌─────────────────┐ ┌─────────────────┐│
│ │ UI/UX           │ │ データ管理      ││
│ │ - React+TS      │ │ - SQLite        ││
│ │ - Fluent UI     │ │ - Drizzle ORM   ││
│ │ - MapLibre GL   │ │ - ファイルI/O   ││
│ └─────────────────┘ └─────────────────┘│
└─────────────────┬───────────────────────┘
                  │ IPC通信（child_process.spawn）
┌─────────────────┴───────────────────────┐
│ Pythonエンジン（バックエンド）          │
│ ┌─────────────────┐ ┌─────────────────┐│
│ │ 機械学習        │ │ 地理空間処理    ││
│ │ - LightGBM      │ │ - GeoPandas     ││
│ │ - scikit-learn  │ │ - Shapely       ││
│ │ - Optuna        │ │ - Fiona         ││
│ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────┘
```

### Electron ↔ Python 連携の仕組み

1. ElectronメインプロセスがPythonバイナリを`child_process.spawn`で起動します
2. JSON形式でパラメータを渡してML処理を実行します
3. 処理結果をSQLiteデータベース経由で連携します
4. リアルタイムでElectron側に進捗状況を通知します

### ディレクトリ構造

```
links-akiya/
├── app/                    # Electronアプリケーション
│   ├── src/
│   │   ├── main.ts        # Electronメインプロセス
│   │   ├── renderer.tsx   # レンダラープロセスエントリ
│   │   ├── features/      # 機能ドメイン別モジュール（垂直スライス）
│   │   │   ├── bi/        # BIビュー（地図・グラフ・テーブル）
│   │   │   ├── dataset/   # データセット管理
│   │   │   ├── normalization/ # 名寄せ処理
│   │   │   ├── job/       # 処理一覧
│   │   │   ├── workbook/  # ワークブック
│   │   │   ├── model/     # モデル管理
│   │   │   ├── evaluation/# 空き家推定
│   │   │   └── app-info/  # アプリ情報
│   │   ├── shared/        # 複数featureで共有するコード
│   │   ├── db/            # データベーススキーマ・クライアント
│   │   └── ipc-main-listeners/ # IPCエントリポイント
│   ├── database/          # アプリケーションデータ
│   └── public/            # 静的ファイル（地図タイル等）
├── ml/                    # 機械学習エンジン
│   ├── src/
│   │   ├── E001_DataMatching/     # データマッチング
│   │   ├── E002_Classification/   # 分類モデル
│   │   └── E003_Summarization/    # 集計処理
│   └── async_tasks/       # 非同期タスク実装
├── docs/                  # 開発ドキュメント（ADR、テスト、ガイド）
└── package.json           # モノレポ設定
```

設計の詳細は [ADR-0011: ディレクトリ構造の垂直スライス化](./docs/adr/0011-directory-structure.md) を参照してください。

## 技術スタック

### Electronアプリ（UI・データ管理）

- **Framework**: Electron + React + TypeScript
- **Build Tool**: Vite
- **UI Library**: Fluent UI React Components
- **Map**: MapLibre GL JS + PMTiles
- **Chart**: Recharts
- **Database**: SQLite3 (better-sqlite3) + Drizzle ORM
- **State Management**: Jotai + SWR

### Pythonエンジン（ML・地理空間処理）

- **Language**: Python 3.11-3.13
- **ML Framework**: LightGBM, scikit-learn
- **Geospatial**: GeoPandas, Shapely, Fiona
- **Data Processing**: Pandas, NumPy
- **Optimization**: Optuna
- **Build**: PyInstaller（スタンドアロン実行ファイル生成）

### 技術選定理由

- **Electron**: オフライン動作要件およびデスクトップアプリとしての配布のために採用しています
- **Python**: 機械学習・地理空間処理に特化したライブラリエコシステムを活用しています
- **SQLite**: ローカルデータ保存に適しており、軽量でファイルベースでの配布が容易です
- **PMTiles**: 地図タイルの効率的な配信とオフライン対応が可能です

## 開発環境セットアップ

### 前提条件

- Node.js v20.x
- Python 3.11-3.13
- Poetry（Pythonパッケージ管理）
- Git

### 初回セットアップ

#### 1. リポジトリのクローン

```bash
git clone https://github.com/Project-LINKS-mlitoss/LINKS-SOMA.git
cd LINKS-SOMA/links-soma
```

#### 2. 地図データの配置

開発には地図データが必要です。ビルドスクリプトで生成・配置してください。

```bash
./basemap/build.sh --region kanto
cp basemap/output/kanto/basemap.pmtiles app/public/basemap.pmtiles
```

詳細は [ベースマップビルドガイド](./docs/guides/basemap-build.md) を参照。

#### 3. 依存関係のインストール

```bash
# Node.js依存関係
npm install

# Python依存関係（mlディレクトリで実行）
cd ml
poetry install
cd ..
```

#### 4. Pythonバイナリのビルド

名寄せ・推定等のML処理を使用する場合、Pythonバイナリのビルドが必要です。

```bash
cd ml && npm run build
```

ビルドスクリプトの詳細は [ml/README.md](./ml/README.md) を参照してください。

#### 5. 開発サーバーの起動

```bash
npm run dev
```

### よく使うコマンド

```bash
# 開発サーバー起動（Electron + Python）
npm run dev

# ビルド（配布用）
npm run make

# Lintチェック
npm run lint

# データベースマイグレーション生成
cd app && npm run gen:migration

# テスト実行
cd app && npm run test:unit      # ユニットテスト（Vitest）
cd app && npm run e2e            # E2Eテスト（devモード、フィクスチャ準備が必要）
# E2Eテストの前提条件・実行手順の詳細は docs/testing/e2e-test-guide.md を参照

# Pythonビルド（バイナリ生成）
cd ml && npm run build
```

## 運用・ビルド・配布

### GitHub Actionsによる自動テスト

`ml/` ディレクトリを変更する PR では、pytest + カバレッジを自動実行します。

- ワークフロー: `.github/workflows/test.yml`
- トリガー: `ml/src/**`, `ml/tests/**`, `ml/pyproject.toml`, `ml/poetry.lock`, または workflow 自身 (`.github/workflows/test.yml`) の変更を含む PR
- 結果: PR コメントにカバレッジ率 + pytest 出力末尾を sticky 投稿
- 備考: カバレッジ率の閾値ゲートは設定していない（可視化のみ）

### GitHub Actionsによる自動 lint

`app/` ディレクトリを変更する PR では、`npm run lint`（ESLint + `tsc --noEmit`）を自動実行します。

- ワークフロー: `.github/workflows/lint.yml`
- トリガー: `app/**`, `package.json`, `package-lock.json`, `turbo.json`, または workflow 自身 (`.github/workflows/lint.yml`) の変更を含む PR（および `develop` への push）
- 結果: ESLint の警告は `##[warning]` 形式で annotation 化され、PR の Checks タブ / Summary / Files changed に表示
- 備考: 警告は block せず、reviewer が annotation で確認するのみ（詳細は [ADR-0021](./docs/adr/0021-lint-ci-automation.md)）

### GitHub Actionsによる自動ビルド

プロジェクトはGitHub Actionsで地域別に8種類のアプリケーションを自動ビルドします。

- 地域: hokkaido, tohoku, kanto, chubu, kansai, chugoku, shikoku, kyushu
- プラットフォーム: Windows
- ワークフロー: `.github/workflows/build.yml`

### ビルド成果物の取得方法

1. GitHub Actionsページで「Build Electron Apps」ワークフローを手動実行します
2. ビルド完了後、Artifactsからzipファイルをダウンロードします
3. 配布先の地方自治体に応じた地域版を選択します

### ローカルビルド

```bash
# 配布用アプリをビルド
npm run make

# ビルド成果物の確認
ls app/out/
```

## データベース管理

### スキーマ変更手順

1. `app/src/db/schema.ts`を編集します
2. `cd app && npm run gen:migration`でマイグレーションを生成します
3. アプリ起動時に自動適用されます

### データベースファイル

- 開発環境: `app/database/database.db`
- 本番環境: ユーザーディレクトリ内に自動作成されます

### プリセットモデル機能

アプリケーション初回起動時に、`app/public/prepared-models/`配下のzipファイルが自動的にモデルファイルとしてアプリケーションに登録されます。

- 自動登録対象: `.zip`形式のモデルファイル
- 配置場所: ユーザーデータディレクトリの`models/`フォルダ
- 登録タイミング: データベースにモデルファイルが存在しない初回起動時のみ

## ドキュメント

- [開発ドキュメント](./docs/README.md) — 技術仕様、ADR、テスト、開発ガイドライン
- [R8 業務仕様書](./requirements/R8_業務仕様書.md) — 契約上の機能要件（FR）・インプットデータ（IF）・非機能要件（NR）

## 開発ワークフロー

### ブランチ運用

| ブランチ   | 用途             | 分岐元  | マージ先 |
| ---------- | ---------------- | ------- | -------- |
| `main`     | 本番リリース版   | -       | -        |
| `develop`  | 開発統合ブランチ | main    | main     |
| `feat/*`   | 機能開発         | develop | develop  |
| `hotfix/*` | 緊急修正         | main    | main     |

### 開発フロー

1. `develop`ブランチから`feat/*`ブランチを作成します
2. 機能開発・テストを行います
3. `develop`へのPR作成を行います（必ず`--base develop`を指定してください）
4. コードレビュー・マージを行います
5. 定期的に`develop` → `main`へのリリースを行います

### コミット・PR作成ルール

- コミットメッセージは`feat:`, `fix:`, `refactor:` などの接頭辞を使用してください
- PRは必ず`develop`ブランチ宛に作成してください: `gh pr create --base develop`
- Claude Code生成文言は削除してください

## トラブルシューティング

### よくある問題

#### Q: 地図が表示されない

**A**: `app/public/basemap.pmtiles`が正しく配置されているか確認してください。取得方法は [ベースマップビルドガイド](./docs/guides/basemap-build.md) を参照。

#### Q: Pythonビルドが失敗する

**A**: Poetry環境が正しくセットアップされているか確認してください。

#### Q: Electronビルド時にエラーが発生する

**A**: `npm run rebuild`でnative modulesを再ビルドしてください。

#### Q: データインポートができない

**A**: ファイル形式とエンコーディング（UTF-8推奨）を確認してください。
