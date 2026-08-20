import { describe, expect, it } from "vitest";
import { type ModelCreateTaskResult } from "../../../shared/types/job-task-result";
import {
  formatCandidateCount,
  formatLift,
  formatRatioAsPercent,
  formatThresholdScore,
  importantColumnsTitle,
  toModelResultSections,
} from "./model-result-rows";

/** モデル構築結果。テストで使うフィールドだけ埋める */
const modelResult = (
  overrides: Partial<ModelCreateTaskResult> = {},
): ModelCreateTaskResult => ({
  taskResultType: "model_create",
  precisionAt100: "0.88",
  precisionAt500: "0.724",
  precisionAt1000: "0.61",
  precisionAt3000: "0.42",
  precisionAt5000: "0.31",
  liftAt1000: "8.712",
  liftAt5000: "4.2",
  recallTarget: "0.8",
  threshold: "0.34212",
  candidateCount: "4210",
  candidateRatio: "0.084",
  important_columns: [],
  ...overrides,
});

describe("値の書式", () => {
  it("比率をパーセントへ直す。E021 が 0〜1 の比率で返すため", () => {
    expect(formatRatioAsPercent("0.884")).toBe("88.4%");
  });

  it("Lift は倍率と読めるよう x を付ける", () => {
    expect(formatLift("8.712")).toBe("8.71x");
  });

  it("判定閾値スコアは小数4桁まで残す。候補件数の境目を再現できるようにするため", () => {
    expect(formatThresholdScore("0.34212")).toBe("0.3421");
  });

  it("候補件数は桁区切りを付ける", () => {
    expect(formatCandidateCount("4210")).toBe("4,210件");
  });

  it("値が無い・数値でないときは画面と同じ空値表示にする", () => {
    expect(formatRatioAsPercent(undefined)).toBe("--");
    expect(formatLift("N/A")).toBe("--");
    expect(formatThresholdScore("")).toBe("--");
    expect(formatCandidateCount("なし")).toBe("--");
  });
});

describe("importantColumnsTitle", () => {
  it("上限件数ちょうどなら絞り込みが起きたとみなして件数を添える", () => {
    expect(importantColumnsTitle(20)).toBe("特徴量重要度（上位20件を表示）");
    expect(importantColumnsTitle(7)).toBe("特徴量重要度");
  });
});

describe("toModelResultSections", () => {
  it("結果が無くてもモデル名は出す。保存済みモデルの特定に要るため", () => {
    expect(
      toModelResultSections({ result: null, modelFileName: "2026年モデル" }),
    ).toEqual([
      { title: "モデル", rows: [["モデルファイル名", "2026年モデル"]] },
    ]);
  });

  it("未保存のモデルは名前の行を作らない", () => {
    expect(toModelResultSections({ result: null })).toEqual([]);
  });

  it("画面のカード1枚を1セクションにする", () => {
    const sections = toModelResultSections({
      result: modelResult({
        important_columns: [{ column: "築年数", value: "0.182" }],
      }),
      modelFileName: "2026年モデル",
    });

    expect(sections.map((s) => s.title)).toEqual([
      "モデル",
      "Precision@K（上位K件中の空き家割合）",
      "Lift（ランダム抽出比）",
      "判定ライン",
      "特徴量重要度",
    ]);
  });

  it("Precision@K・Lift を画面の表と同じ並びで出す", () => {
    const sections = toModelResultSections({ result: modelResult() });

    expect(sections[0].rows).toEqual([
      ["上位100件", "88.0%"],
      ["上位500件", "72.4%"],
      ["上位1,000件", "61.0%"],
      ["上位3,000件", "42.0%"],
      ["上位5,000件", "31.0%"],
    ]);
    expect(sections[1].rows).toEqual([
      ["上位1,000件", "8.71x"],
      ["上位5,000件", "4.20x"],
    ]);
  });

  it("判定ラインの4項目を出す", () => {
    const sections = toModelResultSections({ result: modelResult() });

    expect(sections[2].rows).toEqual([
      ["再現率目標", "80.0%"],
      ["判定閾値スコア", "0.3421"],
      ["候補件数", "4,210件"],
      ["候補割合", "8.4%"],
    ]);
  });

  it("特徴量重要度が空ならセクションを作らない", () => {
    const sections = toModelResultSections({ result: modelResult() });
    expect(sections.map((s) => s.title)).not.toContain("特徴量重要度");
  });
});
