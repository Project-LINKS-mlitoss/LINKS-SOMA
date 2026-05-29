# ML エンジン

LINKS SOMAの機械学習・地理空間処理バックエンド。Python 3.11-3.13、Poetry管理。

環境構築の全体手順は [ルートREADME](../README.md) を参照。

## ビルド

### ビルドスクリプトの構成

本プロジェクトには2つのビルドスクリプトがあり、用途が異なる:

| ファイル | 用途 | 実行環境 |
|---------|------|---------|
| `build.js` | ローカル開発用 | macOS / Linux |
| `build.ps1` | CI/CD 用 | Windows (GitHub Actions) |

> **注**: `build.ps1` は Windows バイナリのビルド用。pytest のテスト実行は別ワークフロー `.github/workflows/test.yml` で PR 時に自動実行される（Ubuntu、Python 3.11、Poetry 1.8.3）。詳細は [docs/testing/unit-test-guide.md](../docs/testing/unit-test-guide.md) 参照。

### 使い分け

```
ローカル開発（macOS/Linux）:
  npm run build → build.js を実行

CI/CD（GitHub Actions）:
  ./build.ps1 → build.ps1 を直接実行（.github/workflows/build.yml で定義）
```

### 注意事項

- **スクリプトは別々に管理されている**: 一方を修正しても、もう一方には反映されない
- **設定変更時は両方を確認**: ビルド設定を変更する場合、両ファイルの同期を検討する
- **OS 固有の問題**: pyogrio の互換性問題は macOS arm64 固有のため、`build.js` のみで対応

### 設定の差分（2026-03-19 時点）

| 設定項目 | build.js | build.ps1 |
|---------|----------|-----------|
| pyogrio 除外 | あり | なし（Windows では不要） |
| hidden-import | あり | あり（IF002/IF003 に joblib） |
| paths 拡張 | あり（PATHS 定数） | なし（`--paths="./src"` のみ） |

> **補足**: Windows では pyogrio の互換性問題が発生しないため、`build.ps1` での除外は不要。
> hidden-import やパス拡張の問題が Windows でも発生する場合は、`build.ps1` の更新が必要。

### 正常なビルド手順

```bash
cd ml

# 1. 依存関係のインストール
poetry install

# 2. バイナリのビルド
npm run build
```

個別ビルドも可能:
```bash
npm run build -- IF001          # IF001のみビルド
npm run build -- IF001 IF003    # 複数指定
```

### 生成されるバイナリ

`dist/` ディレクトリに以下のバイナリが生成される:

| バイナリ | 説明 |
|---------|------|
| `IF001` | データマッチング処理（名寄せ） |
| `IF002` | モデル構築 |
| `IF003` | 空き家分析（推定） |
| `IF004` | データ出力 |
| `IF005` | テキスト結合支援（結合チェック） |

### ビルド結果の確認

ビルド後、以下のコマンドで各バイナリが正常に動作するか確認:

```bash
./dist/IF001 --help
./dist/IF002 --help
./dist/IF003 --help
./dist/IF004 --help
./dist/IF005 --help
```

正常な場合の出力例:
```
usage: IF005 [-h] [--parameters PARAMETERS]

IF005 テキスト結合支援

options:
  -h, --help            show this help message and exit
  --parameters PARAMETERS
```

## テスト

```bash
cd ml
npm test    # poetry run pytest tests/ -v
```

## トラブルシューティング

ビルドエラーが発生した場合は [MLバイナリビルド トラブルシューティング](../docs/troubleshooting/ml-build.md) を参照。
