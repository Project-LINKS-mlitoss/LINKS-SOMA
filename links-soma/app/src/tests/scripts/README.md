# 操作スクリプト (tests/scripts/)

パイプライン実行やデータ準備を UI 経由で行う Playwright スクリプト群。E2E テストではなく、**手動確認を前提とした操作自動化** に位置付ける。

## e2e/ との違い

`app/src/tests/e2e/` と `app/src/tests/scripts/` は同じ Playwright + `setupApp()` の基盤を共有するが、**ライフサイクルが違う**。

| 観点                | `e2e/`                       | `scripts/`                                 |
| ------------------- | ---------------------------- | ------------------------------------------ |
| 実行目的            | 自動検証（assert 中心）      | 手動確認の前段準備（データ作成・遷移再現） |
| `test.afterAll`     | `electronApp.close()` を呼ぶ | **意図的に省略**（アプリを開いたまま）     |
| `setupApp()` 戻り値 | `{ electronApp, page }` 両方 | `{ page }` のみ使う                        |
| 実行コマンド        | `npm run e2e -- <filter>`    | `npm run script -- <name>`                 |
| 失敗の扱い          | CI が検知して PR を block    | 開発者が画面を見て判断                     |

**重要**: scripts/ では `electronApp.close()` を呼ばないため、`setupApp()` が返す `electronApp` を受け取らない。分割代入は `page` のみにする。

```ts
// ✅ scripts/ の書き方
import { test, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";

let page: Page;

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略
```

```ts
// ❌ e2e/ の書き方を scripts/ に持ち込まない
import { test, type ElectronApplication, type Page } from "@playwright/test";

let electronApp: ElectronApplication; // ← scripts/ では未使用警告になる
let page: Page;

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close(); // ← scripts/ ではアプリを閉じてはいけない
});
```

## ファイル命名規約

- `{操作名}.ts`（`script-` プレフィックスは不要）
- 例: `run-normalization.ts`, `setup-bi-workbook.ts`

詳細は [docs/testing/README.md §テストの組織化ルール](../../../../docs/testing/README.md) を参照。

## 実行方法

```bash
cd app
npm run dev                     # 別ターミナルで dev サーバー起動（e2e:check-dev ガードの前提）
npm run script -- <name>        # 例: npm run script -- run-normalization
```

個別スクリプトの用途・所要時間・前提条件は、各ファイル冒頭の JSDoc に記載されている。
