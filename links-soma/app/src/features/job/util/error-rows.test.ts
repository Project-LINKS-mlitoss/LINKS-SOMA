import { describe, expect, it } from "vitest";
import { type SelectJobTask } from "../../../db/schema";
import { toErrorSections } from "./error-rows";

/** job_tasks の1行。テストで使うフィールドだけ埋める */
const task = (overrides: Partial<SelectJobTask>): SelectJobTask =>
  ({
    id: 1,
    job_id: 1,
    progress_percent: "",
    preprocess_type: null,
    error_code: null,
    error_msg: null,
    result: null,
    finished_at: null,
    created_at: "2026-08-14 10:00:00",
    updated_at: "2026-08-14 10:00:00",
    ...overrides,
  }) as SelectJobTask;

describe("toErrorSections", () => {
  it("エラーが無ければセクションを作らない", () => {
    expect(toErrorSections(undefined)).toEqual([]);
    expect(toErrorSections([])).toEqual([]);
    expect(toErrorSections([task({ error_msg: null })])).toEqual([]);
  });

  it("エラーメッセージだけのタスクでも出す。詳細が無いエラーを落とさないため", () => {
    expect(toErrorSections([task({ error_msg: "不明なエラー" })])).toEqual([
      { title: "エラー", rows: [["エラー内容", "不明なエラー"]] },
    ]);
  });

  it("責任分界を職員向けの対応区分へ言い換える", () => {
    const sections = toErrorSections([
      task({
        error_msg: "説明変数に数値化できない値が含まれます",
        result: {
          error_detail: {
            responsibility: "自治体修正",
            next_action: "データを修正して再実行してください",
            display_code: "E-201",
          },
        },
      }),
    ]);

    expect(sections[0].rows).toEqual([
      ["エラー内容", "説明変数に数値化できない値が含まれます"],
      ["対応", "データの修正"],
      ["次のアクション", "データを修正して再実行してください"],
    ]);
  });

  it("未知の責任分界はそのまま出す。表示が空になるのを避けるため", () => {
    const sections = toErrorSections([
      task({
        error_msg: "エラー",
        result: {
          error_detail: {
            responsibility: "未知の区分",
            next_action: "",
            display_code: "",
          },
        },
      }),
    ]);

    expect(sections[0].rows).toContainEqual(["対応", "未知の区分"]);
  });

  it("修正方法の箇条書きと複数例を1行へ畳む", () => {
    const sections = toErrorSections([
      task({
        error_msg: "築年数の形式が不正です",
        result: {
          error_detail: {
            responsibility: "自治体修正",
            next_action: "修正してください",
            display_code: "E-201",
            fix_guide: {
              what: "築年数は数値のみで入力してください",
              accepted: ["半角数字", "空欄"],
              examples: [
                { before: "築30年", after: "30" },
                { before: "不明", after: "" },
              ],
            },
          },
        },
      }),
    ]);

    expect(sections[0].rows).toContainEqual([
      "修正方法",
      "築年数は数値のみで入力してください",
    ]);
    expect(sections[0].rows).toContainEqual(["正しい形式", "半角数字 / 空欄"]);
    expect(sections[0].rows).toContainEqual([
      "修正例",
      "築30年 → 30 / 不明 → ",
    ]);
  });

  it("失敗したのにメッセージを持つタスクが無ければ、不明のエラーとして出す。失敗した事実を残すため", () => {
    expect(toErrorSections([], "error")).toEqual([
      {
        title: "エラー",
        rows: [["エラー内容", "不明のエラーが発生しました（詳細な記録なし）"]],
      },
    ]);
    expect(toErrorSections(undefined, "error")).toEqual([
      {
        title: "エラー",
        rows: [["エラー内容", "不明のエラーが発生しました（詳細な記録なし）"]],
      },
    ]);
  });

  it("失敗していなければ不明のエラーを出さない", () => {
    expect(toErrorSections([], "complete")).toEqual([]);
    expect(toErrorSections([], "")).toEqual([]);
  });

  it("メッセージを持つタスクがあれば不明のエラーで置き換えない", () => {
    expect(
      toErrorSections([task({ error_msg: "実際のエラー" })], "error"),
    ).toEqual([{ title: "エラー", rows: [["エラー内容", "実際のエラー"]] }]);
  });

  it("結合元データ名をエラーメッセージへ添える。どの入力を直すか読めるため", () => {
    const sections = toErrorSections([
      task({
        error_msg: "結合できませんでした",
        result: {
          taskResultType: "preprocess",
          joining_rate: "0",
          input_source: "「水道閉開栓状況」に「住民基本台帳」を住所で結合（A）",
        },
      }),
    ]);

    expect(sections[0].rows).toEqual([
      [
        "エラー内容",
        "結合できませんでした（「水道閉開栓状況」に「住民基本台帳」を住所で結合（A））",
      ],
    ]);
  });

  it("配列の結合元データ名も1行へ畳む。型が配列を許すため", () => {
    const sections = toErrorSections([
      task({
        error_msg: "結合できませんでした",
        result: {
          taskResultType: "preprocess",
          joining_rate: "0",
          input_source: ["水道閉開栓状況", "住民基本台帳"],
        },
      }),
    ]);

    expect(sections[0].rows).toEqual([
      ["エラー内容", "結合できませんでした（水道閉開栓状況, 住民基本台帳）"],
    ]);
  });

  it("結合元データ名が無ければ空の括弧を付けない", () => {
    const sections = toErrorSections([
      task({
        error_msg: "結合できませんでした",
        result: { taskResultType: "preprocess", joining_rate: "0" },
      }),
    ]);

    expect(sections[0].rows).toEqual([["エラー内容", "結合できませんでした"]]);
  });

  it("複数エラーはセクションを分ける。どの修正方法がどのエラーのものか読めるため", () => {
    const sections = toErrorSections([
      task({ id: 1, error_msg: "1件目" }),
      task({ id: 2, error_msg: null }),
      task({ id: 3, error_msg: "2件目" }),
    ]);

    expect(sections).toEqual([
      { title: "エラー1", rows: [["エラー内容", "1件目"]] },
      { title: "エラー2", rows: [["エラー内容", "2件目"]] },
    ]);
  });
});
