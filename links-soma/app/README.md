# Electron アプリケーション

LINKS SOMAのフロントエンド。Electron + React + TypeScript、Vite、Fluent UI。

環境構築の全体手順は [ルートREADME](../README.md) を参照。

## スクリプト一覧

ルートから `turbo` 経由で実行されるスクリプト（`dev`, `make`, `lint`）はルートREADMEを参照。以下はapp/配下で直接実行するスクリプト:

### テスト

| コマンド | 説明 |
|---------|------|
| `npm run test:unit` | ユニットテスト（Vitest） |
| `npm run e2e` | E2Eテスト（devモード） |
| `npm run e2e:built` | E2Eテスト（ビルド済みアプリ） |
| `npm run e2e:help` | 利用可能なE2Eテスト一覧 |

### 操作スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run script` | 操作スクリプト実行（devモード） |
| `npm run script:built` | 操作スクリプト実行（ビルド済みアプリ） |
| `npm run script:help` | 利用可能なスクリプト一覧 |

詳細は [E2Eテスト実行ガイド](../docs/testing/e2e-test-guide.md) を参照。

### データベース

| コマンド | 説明 |
|---------|------|
| `npm run gen:migration` | Drizzle ORMマイグレーション生成 |

### ビルド・開発ツール

| コマンド | 説明 |
|---------|------|
| `npm run rebuild` | better-sqlite3のネイティブモジュールリビルド |
| `npm run ipc:snapshot` | IPCチャンネルのスナップショット取得 |
| `npm run ipc:verify` | IPCチャンネルの整合性検証 |

## 注意事項

- **better-sqlite3のリビルド**: Electronのバージョンに合わせてネイティブモジュールのリビルドが必要。`npm run make` / `npm run package` は自動で `rebuild` を実行するため通常は意識不要。詳細は [トラブルシューティング](../docs/guides/troubleshooting.md) を参照
