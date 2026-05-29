# LP (LINKS SOMA 製品紹介サイト)

このディレクトリは LINKS SOMA の LP の SSOT。`Project-LINKS-mlitoss/LINKS-SOMA` の `docs/` 配下に同期し、GitHub Pages 経由で公開する。

## 公開 URL

https://project-links-mlitoss.github.io/LINKS-SOMA/

## 構成

```
lp/
├── index.html       LP 本体
├── styles.css       スタイル
└── assets/          画像・フォント・アイコン
    ├── logo.png
    ├── fonts/       Noto Sans JP セルフホスト
    ├── icons/
    └── screenshots/ 操作画面スクリーンショット (Hero + STEP 1〜5)
```

## 同期手順

LP を編集したら、SSOT 側で commit 後、LINKS-SOMA に反映する:

```bash
rsync -av --exclude='.DS_Store' \
  <links-akiya>/lp/ \
  <LINKS-SOMA>/docs/
```

LINKS-SOMA 側で `git add docs/` + commit + push (main 直)。

## ローカルプレビュー

```bash
python3 -m http.server -d lp 8000
```

`http://localhost:8000/` で開く。

## 関連ドキュメント

- 公開フロー詳細: [docs/guides/oss-release.md セクション 9](../docs/guides/oss-release.md)
