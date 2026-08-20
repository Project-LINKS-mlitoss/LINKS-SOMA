/**
 * 観点（AspectId）→ 事前バリデーションコード `PV-NN`（ADR-0027）。
 *
 * 採番の正本は網羅表「検査観点マスタ」（`requirements/refinements/...網羅表.md`）。
 * ここは実装済み観点の AspectId とコードの対応のみを持つ。`Record<AspectId, ...>`
 * により、検出器（AspectId）を増やすとコードの採番が型で強制される（採番漏れ防止）。
 */

import type { AspectId } from "./types";

export const PV_CODE: Record<AspectId, string> = {
  uniqueness: "PV-07",
  data_type_numeric: "PV-04",
  value_range: "PV-05",
  missing_value: "PV-06",
  date_format: "PV-09",
};
// PV-14（期間カバレッジ）は事前で検査しない。Python は集計窓（基準日から遡る1年・
// water.py: usage_window_start）の外の検針を捨て、窓に検針が無ければ事後に E-0020 を
// 出す。事前ゲートを設けるかは未判断。

// 観点の表示名（「一意性」等）は UI 文言として lang.ts
// （components.normalizationPreValidation.labels）に集約。観点キー = AspectId で引く。
