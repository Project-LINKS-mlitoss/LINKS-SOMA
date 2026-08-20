/**
 * データセット（schemaKey）→ 適用するデータチェックのカタログ。
 *
 * 網羅表（`requirements/refinements/...網羅表.csv`）の実装対象行に対応する。
 * `columnKey` はフォームの論理カラムキー（`use-form-normalization.ts` の columns）。
 * 実カラム名はユーザーのマッピング次第なので、実行時に form の columns で解決する。
 *
 * 軽量ゲートで素直に出せる観点のみを置く（サンプリングの片側性が成立するもの）。
 * 文字コード・ファイル形式（ファイル単位）、参照整合（クロスファイル）、住所表記混在
 * （正規化層）は対象外。building_polygon は CSV カラムを持たないため空。
 */

import type { AspectId } from "./types";

export type DatasetRule = {
  /** フォーム columns の論理キー（water_supply_number 等）。 */
  columnKey: string;
  /** 観点。 */
  aspect: AspectId;
  /** 失敗時影響（網羅表）。stop=止まる / continue=吸収。 */
  impact?: "stop" | "continue";
  /** value_range の下限・上限。 */
  min?: number;
  max?: number;
};

export const RULES_BY_DATASET: Record<string, DatasetRule[]> = {
  water_status: [
    // 水道番号の一意性（PV-07）は事前で検査しない。1メーターに開栓・閉栓の履歴行が並ぶ
    // のが正常で、本体（water.py `load_water_status`）が水道番号を一意化してから使う。
    // 重複は利用者が CSV を直して解消する類ではなく、warn は不要な修正を促す偽陽性になる。
    // どの行を残すかは city_cfg（dedup_by_latest_start_date 等）の設定次第で、設定が無い
    // 自治体はファイル順の先頭が残る。これは設定側の問題であり事前ゲートの担当ではない。
    // 同一番号を別住所に振った入力ミスも検出しなくなるが、正常な履歴行と区別できず
    // 偽陽性が上回るため許容する（#1990）。
    {
      columnKey: "water_supply_number",
      aspect: "missing_value",
      impact: "continue",
    },
    {
      columnKey: "water_connection_date",
      aspect: "date_format",
      impact: "continue",
    },
    {
      columnKey: "water_disconnection_date",
      aspect: "date_format",
      impact: "continue",
    },
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
  ],
  water_usage: [
    {
      columnKey: "water_supply_number",
      aspect: "missing_value",
      impact: "continue",
    },
    {
      columnKey: "water_usage",
      aspect: "data_type_numeric",
      impact: "continue",
    },
    {
      columnKey: "water_recorded_date",
      aspect: "date_format",
      impact: "continue",
    },
    // 期間カバレッジ（PV-14）は事前で検査しない。Python は集計窓（基準日から遡る1年）で
    // 処理し、窓に検針が無ければ事後に E-0020 を出す。事前ゲートを設けるかは未判断。
  ],
  resident_registry: [
    // 世帯コードの一意性（PV-07）は事前で検査しない。住基は snapshot 型で 1住所に複数
    // 世帯コード行が並ぶのが正常（juki.py は groupby で集約）。重複を warn すると偽陽性になる。
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
    { columnKey: "birth_date", aspect: "date_format", impact: "continue" },
    { columnKey: "resident_date", aspect: "date_format", impact: "continue" },
    { columnKey: "date_transfer", aspect: "date_format", impact: "continue" },
  ],
  geocoding: [
    // 値域（PV-05）は事前=標本で早期に拾い、事後（import_validation の
    // GEOCODING_IMPORT_SPECS）が全件で確定する。範囲外座標（取り違え・単位ミス）は
    // points_from_xy が黙って誤 Point にするため、事前後の両層で範囲検証する。
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
    {
      columnKey: "latitude",
      aspect: "value_range",
      impact: "continue",
      min: -90,
      max: 90,
    },
    {
      columnKey: "longitude",
      aspect: "value_range",
      impact: "continue",
      min: -180,
      max: 180,
    },
  ],
  building_registry: [
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
    {
      columnKey: "registration_date",
      aspect: "date_format",
      impact: "continue",
    },
    // 登記理由は分類テキスト（売買/相続/所有権移転）。現パイプラインは登記日付を別カラムで
    // 受け取りキーワード一致するだけで、先頭8桁の複合分割（旧E013）は行わない。よって
    // composite_format 検査は持たない（あるべき検証でないため発明しない）。
  ],
  building_type_determination: [
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
  ],
  vacant_house: [
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
  ],
  optional_data_source: [
    { columnKey: "address", aspect: "missing_value", impact: "continue" },
  ],
};
