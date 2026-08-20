/**
 * SOMA 定義のシステム提供ビュープリセット（read-only）。ユーザー作成分は DB（view_templates）。
 *
 * 各プリセットは data_set_result_id を含まない（データ非依存）。適用時に毎回バインドする。
 * layoutIndex はレイアウトテンプレート（preview-result-sheet.tsx）に対応し 4 ビューまで grid 割当済み。
 */

import { type Parameter, type ViewTemplateView } from "../types";
import { viewTemplateSchema } from "../types/schema/view-template";

export type SystemViewPreset = {
  /** 安定キー。一覧では `system:<key>` として露出する */
  key: string;
  name: string;
  description: string;
  views: ViewTemplateView[];
};

/**
 * 円グラフ用の推定確率区分（0〜100%を4分割）。ラベル列を count 集計してドーナツ表示する。
 * floatRange の startValue/lastValue はパーセント表記で持つ（fetch 側で 1/100 に換算される）。
 */
const probabilityBucketGroups: Parameter[] = [
  { start: 0, last: 25 },
  { start: 26, last: 50 },
  { start: 51, last: 75 },
  { start: 76, last: 100 },
].map(({ start, last }) => ({
  key: `group_prob_${start}_${last}`,
  type: "group",
  value: {
    label: `空き家推定確率${start}~${last}%`,
    referenceColumnType: "floatRange",
    operation: "range",
    startValue: start,
    lastValue: last,
    includesStart: true,
    includesLast: true,
  },
}));

export const SYSTEM_VIEW_PRESETS: SystemViewPreset[] = [
  {
    key: "building-overview",
    name: "建物単位の分析",
    description:
      "建物単位で利用できる地図・表・円グラフをまとめたビュー構成です。建物ごとの空き家推定確率の分布を確認できます。",
    views: [
      {
        title: "建物マップ",
        unit: "building",
        style: "map-with-table",
        layoutIndex: 1,
        parameters: [
          {
            key: "columns",
            type: "column",
            value:
              "normalized_address,area_group,predicted_probability,predicted_label",
          },
        ],
      },
      {
        title: "建物一覧",
        unit: "building",
        style: "table",
        layoutIndex: 2,
        parameters: [
          {
            key: "columns",
            type: "column",
            value:
              "normalized_address,area_group,predicted_probability,predicted_label",
          },
        ],
      },
      {
        title: "推定確率の分布",
        unit: "building",
        style: "pie",
        layoutIndex: 3,
        parameters: [
          { key: "label", type: "column", value: "predicted_probability" },
          { key: "value", type: "column", value: "predicted_probability" },
          ...probabilityBucketGroups,
          {
            key: "group_aggregation",
            type: "group_aggregation",
            value: "count",
          },
        ],
      },
    ],
  },
  {
    key: "area-overview",
    name: "地域単位の分析",
    description:
      "地域単位で利用できる地図・表・棒グラフをまとめたビュー構成です。地域ごとの空き家件数と推定確率を確認できます。",
    views: [
      {
        title: "地域マップ",
        unit: "area",
        style: "map-with-table",
        layoutIndex: 1,
        parameters: [
          {
            key: "columns",
            type: "column",
            value: "area_group,vacant_house_count,predicted_probability",
          },
        ],
      },
      {
        title: "地域別一覧",
        unit: "area",
        style: "table",
        layoutIndex: 2,
        parameters: [
          {
            key: "columns",
            type: "column",
            value:
              "area_group,total_building_count,vacant_house_count,predicted_probability",
          },
        ],
      },
      {
        title: "地域別 空き家件数",
        unit: "area",
        style: "bar",
        layoutIndex: 3,
        parameters: [
          { key: "xAxis", type: "column", value: "area_group" },
          { key: "yAxis", type: "column", value: "vacant_house_count" },
        ],
      },
    ],
  },
  {
    key: "multi-year-trend",
    name: "複数年の分析",
    description:
      "推定基準日（複数年）ごとの空き家推定確率の推移を折れ線と表で確認します。複数の基準日を持つ推定結果に適用してください。",
    views: [
      {
        title: "推定確率の推移",
        unit: "building",
        style: "line",
        layoutIndex: 1,
        parameters: [
          { key: "xAxis", type: "column", value: "reference_date" },
          { key: "yAxis", type: "column", value: "predicted_probability" },
        ],
      },
      {
        title: "基準日別 一覧",
        unit: "building",
        style: "table",
        layoutIndex: 2,
        parameters: [
          {
            key: "columns",
            type: "column",
            value:
              "normalized_address,reference_date,predicted_probability,predicted_label",
          },
        ],
      },
    ],
  },
];

/** key からシステムプリセットを解決する。存在しなければ undefined */
export const findSystemViewPreset = (
  key: string,
): SystemViewPreset | undefined =>
  SYSTEM_VIEW_PRESETS.find((preset) => preset.key === key);

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("SYSTEM_VIEW_PRESETS の妥当性", () => {
    it("全プリセットが viewTemplateSchema を満たす", () => {
      for (const preset of SYSTEM_VIEW_PRESETS) {
        const result = viewTemplateSchema.safeParse({
          name: preset.name,
          views: preset.views,
        });
        // 失敗時に原因が分かるよう preset.key を添える
        expect(result.success, `${preset.key}: ${result.error?.message}`).toBe(
          true,
        );
      }
    });

    it("key が一意", () => {
      const keys = SYSTEM_VIEW_PRESETS.map((preset) => preset.key);
      expect(keys).toEqual(Array.from(new Set(keys)));
    });

    it("layoutIndex は 1 から連番で、レイアウトテンプレート上限の 4 を超えない", () => {
      for (const preset of SYSTEM_VIEW_PRESETS) {
        const indexes = preset.views.map((view) => view.layoutIndex);
        const expected = preset.views.map((_, i) => i + 1);
        expect(indexes, preset.key).toEqual(expected);
        expect(preset.views.length, preset.key).toBeLessThanOrEqual(4);
      }
    });
  });
}
