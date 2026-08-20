import { type SelectNormalizedDataSet } from "../../db/schema";
import { type NormalizationPurpose } from "../../features/normalization/hooks/use-form-normalization";
import { lang } from "./lang";

// DB列挙（normalized_data_sets.purpose）とフォーム列挙（NormalizationPurpose）が
// 双方向で一致することを型で保証する。drizzle はリテラル配列しか受けないため定義は
// 二重化するが、片方に値を足し忘れると下の代入がコンパイルエラーになりドリフトを防ぐ。
type PurposeColumn = NonNullable<SelectNormalizedDataSet["purpose"]>;
const _assertPurposeEnumsMatch: [
  PurposeColumn extends NormalizationPurpose ? true : never,
  NormalizationPurpose extends PurposeColumn ? true : never,
] = [true, true];
void _assertPurposeEnumsMatch;

const purposeLang = lang.components.normalizationPurpose;

/**
 * 名寄せの目的（空き家推定 / AIモデル構築）の表示ラベル。
 * 未記録（既存データ・旧ジョブ等）は「—」。short=true で短縮ラベル。
 */
export const normalizationPurposeLabel = (
  purpose: NormalizationPurpose | null | undefined,
  short = false,
): string => {
  switch (purpose) {
    case "vacancy_estimation":
      return short
        ? purposeLang.vacancyEstimation.shortLabel
        : purposeLang.vacancyEstimation.label;
    case "model_training":
      return short
        ? purposeLang.modelTraining.shortLabel
        : purposeLang.modelTraining.label;
    default:
      return purposeLang.unknownLabel;
  }
};
