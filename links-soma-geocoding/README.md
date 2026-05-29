# LINKS SOMA ジオコーディングツール

国土交通省プロジェクト向けの Electron デスクトップアプリ。CSV ファイルの住所データを複数のジオコーディング API で緯度経度に変換する。

## 対応 API

| API | 方式 | 認証 |
|-----|------|------|
| AWS (Amazon Location Service) | HTTP API | API キー |
| NTT (Geospace API) | HTTP API | appid |
| ABR (アドレス・ベース・レジストリ) | ローカル CLI (`abrg`) | 不要（事前にデータDL） |

## セットアップ

```bash
yarn          # 依存パッケージのインストール
```

## 開発

```bash
yarn electron:dev     # ビルド＋Electronアプリ起動
```

## テスト

```bash
yarn e2e              # 全E2Eテスト実行（ビルド含む）
yarn e2e:help         # テスト一覧表示
```

詳細は [docs/testing/](docs/testing/) を参照。

## ビルド・配布

```bash
yarn dist:win         # Windows用パッケージ作成
yarn dist:mac         # macOS用パッケージ作成
```

CI（GitHub Actions）から手動実行も可能: `.github/workflows/build-windows.yml`

## 技術スタック

- **Electron** — デスクトップアプリ基盤
- **React 18** + **Fluent UI v9** — UI
- **react-hook-form** — フォーム管理
- **Vite** — ビルドツール
- **Playwright** — E2Eテスト
- **@digital-go-jp/abr-geocoder** — ABR ジオコーダー CLI

## ドキュメント

- [docs/](docs/) — ドキュメントインデックス
- [docs/testing/](docs/testing/) — テストガイド・チェックリスト
