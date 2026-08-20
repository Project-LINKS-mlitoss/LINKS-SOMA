import { describe, expect, it } from "vitest";
import {
  buildVerificationText,
  sectionsToText,
  type VerificationSection,
} from "./verification-text";

/** 空き家推定が成功したジョブのセクション構成（画面の並びに合わせる） */
const estimationSections = (): VerificationSection[] => [
  {
    rows: [
      ["しきい値", "0.5"],
      ["モデルファイル", "model_0801.zip"],
    ],
  },
  {
    title: "利用データ",
    rows: [
      ["名寄せ処理済データ", "推定日_2026年04月01日_名寄せ処理済みデータ"],
      ["地域集計用データ", "chome_polygon.gpkg"],
      ["地域IDカラム", "KEY_CODE"],
      ["地域名称カラム", "S_NAME"],
    ],
  },
  {
    title: "推定結果",
    rows: [
      ["推定結果ファイル名", "空き家推定結果_0814"],
      ["推定結果件数", "50,000件"],
    ],
  },
  {
    title: "確率帯別の件数",
    rows: [
      ["～10%", "42,103件（84.2%）"],
      ["～20%", "3,201件（6.4%）"],
    ],
  },
  {
    title: "処理時間",
    rows: [["処理全体（実時間）", "2分34秒（154.3秒）"]],
  },
];

describe("sectionsToText", () => {
  it("画面の並びどおりにセクションを並べる", () => {
    expect(sectionsToText("実行情報", estimationSections())).toBe(
      [
        "# 実行情報",
        "",
        "しきい値: 0.5",
        "モデルファイル: model_0801.zip",
        "",
        "【利用データ】",
        "名寄せ処理済データ: 推定日_2026年04月01日_名寄せ処理済みデータ",
        "地域集計用データ: chome_polygon.gpkg",
        "地域IDカラム: KEY_CODE",
        "地域名称カラム: S_NAME",
        "",
        "【推定結果】",
        "推定結果ファイル名: 空き家推定結果_0814",
        "推定結果件数: 50,000件",
        "",
        "【確率帯別の件数】",
        "～10%: 42,103件（84.2%）",
        "～20%: 3,201件（6.4%）",
        "",
        "【処理時間】",
        "処理全体（実時間）: 2分34秒（154.3秒）",
        "",
      ].join("\n"),
    );
  });

  it("行が0件のセクションは丸ごと落とす。空欄の見出しを並べないため", () => {
    const text = sectionsToText("実行情報", [
      { title: "利用データ", rows: [] },
      { title: "推定結果", rows: [["推定結果件数", "1件"]] },
    ]);

    expect(text).not.toContain("利用データ");
    expect(text).toContain("【推定結果】");
  });

  it("地域集計をしないジョブでは地域集計の3行が出ない", () => {
    const text = sectionsToText("実行情報", [
      {
        title: "利用データ",
        rows: [["名寄せ処理済データ", "dataset.csv"]],
      },
    ]);

    expect(text).not.toContain("地域集計用データ");
    expect(text).not.toContain("地域IDカラム");
    expect(text).not.toContain("地域名称カラム");
  });
});

describe("buildVerificationText", () => {
  it("実行ログを区切り線つきで末尾に同梱する", () => {
    const text = buildVerificationText(
      "実行情報",
      [{ rows: [["しきい値", "0.5"]] }],
      "2026-08-14 10:23:45 INFO [IF003] IF003 START",
    );

    const divider = "=".repeat(60);
    expect(text).toBe(
      [
        "# 実行情報",
        "",
        "しきい値: 0.5",
        "",
        divider,
        "実行ログ（開発者向け詳細）",
        divider,
        "2026-08-14 10:23:45 INFO [IF003] IF003 START",
      ].join("\n"),
    );
  });

  it("ログが無ければ上半分だけ返す。旧ジョブ・処理中で logs.txt が無い場合", () => {
    const text = buildVerificationText("実行情報", [
      { rows: [["しきい値", "0.5"]] },
    ]);

    expect(text).not.toContain("=".repeat(60));
    expect(text).toBe(["# 実行情報", "", "しきい値: 0.5", ""].join("\n"));
  });
});
