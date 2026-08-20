import { describe, expect, it } from "vitest";
import { type PreprocessSummaryTaskResult } from "../../../shared/types/job-task-result";
import {
  formatBreakdownPercent,
  toPreprocessSummarySections,
} from "./preprocess-summary-rows";

/** 前処理サマリー。テストで使うフィールドだけ埋める */
const summary = (
  overrides: Partial<PreprocessSummaryTaskResult> = {},
): PreprocessSummaryTaskResult => ({
  taskResultType: "preprocess_summary",
  estimation_target_total_count: 10000,
  record_combinations: [],
  record_combinations_total: 10000,
  building_type_breakdown_total: 10000,
  building_polygon_breakdown_total: 10000,
  ...overrides,
});

describe("formatBreakdownPercent", () => {
  it("割合と件数に加えて母数を併記する。受け取った側で検算できるようにするため", () => {
    expect(formatBreakdownPercent(12.34, 1234, 10000)).toBe(
      "12.3% (1,234件/10,000件中)",
    );
  });
});

describe("toPreprocessSummarySections", () => {
  it("サマリーが無ければセクションを作らない", () => {
    expect(toPreprocessSummarySections(null)).toEqual([]);
    expect(toPreprocessSummarySections(undefined)).toEqual([]);
  });

  it("画面のカード1枚を1セクションにする。母数の異なる構成比を混ぜないため", () => {
    const sections = toPreprocessSummarySections(summary());
    expect(sections.map((s) => s.title)).toEqual([
      "名寄せ処理済データ（推定対象）の総件数",
      "レコードの組み合わせ別",
      "家屋種別",
      "地図表示別",
    ]);
  });

  it("総件数と構成比を別セクションにする。総件数は推定対象、構成比の分母は全行のため", () => {
    // フラグがどれも立たない4,000行が「なし」に入る。総件数はその4,000行を含まない
    const sections = toPreprocessSummarySections(
      summary({
        estimation_target_total_count: 6000,
        record_combinations_total: 10000,
        record_combinations: [
          {
            has_water_supply: true,
            has_juki_registry: true,
            has_touki_registry: false,
            percentage: 60,
            count: 6000,
          },
          {
            has_water_supply: false,
            has_juki_registry: false,
            has_touki_registry: false,
            percentage: 40,
            count: 4000,
          },
        ],
      }),
    );

    expect(sections[0].rows).toEqual([["件数", "6,000件"]]);
    expect(sections[1].rows).toEqual([
      ["水道+住基", "60.0% (6,000件/10,000件中)"],
      ["なし", "40.0% (4,000件/10,000件中)"],
    ]);
  });

  it("家屋種別と地図表示別を、それぞれの母数で出す", () => {
    const sections = toPreprocessSummarySections(
      summary({
        building_type_breakdown: {
          user_specified: { percentage: 80, count: 8000 },
          unknown: { percentage: 20, count: 2000 },
        },
        building_type_breakdown_total: 10000,
        building_polygon_breakdown: {
          with_polygon: { percentage: 70, count: 3500 },
          without_polygon: { percentage: 25, count: 1250 },
          excluded_from_display: { percentage: 5, count: 250 },
        },
        building_polygon_breakdown_total: 5000,
      }),
    );

    expect(sections[2].rows).toEqual([
      ["ユーザーが指定した種別", "80.0% (8,000件/10,000件中)"],
      ["種別不明", "20.0% (2,000件/10,000件中)"],
    ]);
    expect(sections[3].rows).toEqual([
      ["建物ポリゴン表示", "70.0% (3,500件/5,000件中)"],
      ["ポイント表示", "25.0% (1,250件/5,000件中)"],
      ["表示対象外（座標なし）", "5.0% (250件/5,000件中)"],
    ]);
  });

  it("集計が未記録でも行を残す。画面が0%の行を出すため", () => {
    const sections = toPreprocessSummarySections(
      summary({ building_type_breakdown_total: 0 }),
    );

    expect(sections[2].rows).toEqual([
      ["ユーザーが指定した種別", "0.0% (0件/0件中)"],
      ["種別不明", "0.0% (0件/0件中)"],
    ]);
  });
});
