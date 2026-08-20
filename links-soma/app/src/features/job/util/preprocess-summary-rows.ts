/**
 * 名寄せ処理の処理結果画面に出ている内訳を、検証情報ダウンロード（NR007）の
 * セクションへ整形する。
 *
 * 画面のカード1枚 = ファイルの1セクション。母数の異なる件数・構成比を同じ見出しの
 * 下へ並べると、割合の合計が直前の件数と合わず、受け取った側が検算できないため。
 *
 * 構成比の書式 `formatBreakdownPercent` は画面と共有する。画面とファイルが別々に
 * 数値を組み立てると、片方だけ項目が増えたときに気付けない。
 */

import { lang } from "../../../shared/config/lang";
import { type PreprocessSummaryTaskResult } from "../../../shared/types/job-task-result";
import { type VerificationSection } from "./verification-text";

const s = lang.components.preprocessSummary;

type RecordCombination =
  PreprocessSummaryTaskResult["record_combinations"][number];

/**
 * 構成比1件の表示。割合に加えて件数と母数を併記する。
 * 母数が無いと受け取った側で検算できず、隣り合う内訳が同じ母数かも判断できないため。
 */
export const formatBreakdownPercent = (
  percentage: number,
  count: number,
  total: number,
): string =>
  `${percentage.toFixed(1)}% (${count.toLocaleString()}件/${total.toLocaleString()}件中)`;

/**
 * レコードの組み合わせ1件のラベル。
 * 画面は あり/なし の3列で表すが、ファイルは `ラベル: 値` の1行しか持てないため、
 * 持っているデータ名だけを `+` で連ねる。
 */
const recordCombinationLabel = (combination: RecordCombination): string =>
  [
    combination.has_water_supply ? s.waterSupply : null,
    combination.has_juki_registry ? s.jukiRegistry : null,
    combination.has_touki_registry ? s.toukiRegistry : null,
  ]
    .filter(Boolean)
    .join("+") || s.noRecord;

/**
 * 前処理サマリーをセクション群へ展開する。サマリーが無ければ空配列。
 *
 * 家屋種別・地図表示別は値が欠けていても行を残す（画面が `0.0% (0件/0件中)` を
 * 出すため）。画面に出ている行をファイル側だけ落とすと、受け取った側からは
 * 集計されなかったのか転記漏れなのか区別できない。
 */
export const toPreprocessSummarySections = (
  summary: PreprocessSummaryTaskResult | null | undefined,
): VerificationSection[] => {
  if (!summary) return [];

  // 総件数は推定対象（フラグが1つ以上立つ行）、構成比の分母は全行。
  // 「なし」の組み合わせは総件数の外側にいるため、同じ見出しに置くと
  // 合計が総件数と合わず検算できない。画面のカード境界どおり別セクションにする
  const totalCountRows: [string, string][] = [
    [
      s.totalCountLabel,
      `${summary.estimation_target_total_count.toLocaleString()}件`,
    ],
  ];

  const recordCombinationRows: [string, string][] =
    summary.record_combinations.map((combination): [string, string] => [
      recordCombinationLabel(combination),
      formatBreakdownPercent(
        combination.percentage,
        combination.count,
        summary.record_combinations_total,
      ),
    ]);

  const buildingType = summary.building_type_breakdown;
  const buildingTypeRows: [string, string][] = [
    [
      s.buildingTypeUserSpecified,
      formatBreakdownPercent(
        buildingType?.user_specified?.percentage ?? 0,
        buildingType?.user_specified?.count ?? 0,
        summary.building_type_breakdown_total,
      ),
    ],
    [
      s.buildingTypeUnknown,
      formatBreakdownPercent(
        buildingType?.unknown?.percentage ?? 0,
        buildingType?.unknown?.count ?? 0,
        summary.building_type_breakdown_total,
      ),
    ],
  ];

  const polygon = summary.building_polygon_breakdown;
  const mapDisplayRows: [string, string][] = [
    [
      s.mapDisplayWithPolygon,
      formatBreakdownPercent(
        polygon?.with_polygon?.percentage ?? 0,
        polygon?.with_polygon?.count ?? 0,
        summary.building_polygon_breakdown_total,
      ),
    ],
    [
      s.mapDisplayWithoutPolygon,
      formatBreakdownPercent(
        polygon?.without_polygon?.percentage ?? 0,
        polygon?.without_polygon?.count ?? 0,
        summary.building_polygon_breakdown_total,
      ),
    ],
    [
      s.mapDisplayExcluded,
      formatBreakdownPercent(
        polygon?.excluded_from_display?.percentage ?? 0,
        polygon?.excluded_from_display?.count ?? 0,
        summary.building_polygon_breakdown_total,
      ),
    ],
  ];

  return [
    { title: s.totalCountSection, rows: totalCountRows },
    { title: s.recordCombinationSection, rows: recordCombinationRows },
    { title: s.buildingTypeSection, rows: buildingTypeRows },
    { title: s.mapDisplaySection, rows: mapDisplayRows },
  ];
};
