import { translateColumnToJapanese } from "../column-translation-utils";

/** ユーザーが任意で取り込んだ追加説明変数データの1エントリ */
export type OptionalDataSourceEntry = {
  /** カラム名 */
  name: string;
  /** 元データの値 */
  value: unknown;
};

/** 建物関連データの内部カラム名サフィックス */
export const ODS_SUFFIX = "_ods";

/** 建物関連データの表示名プレフィックス */
export const ODS_DISPLAY_PREFIX = "[追加] ";

/**
 * ML側のカラム名 → DB/UI側のカラム名の暫定マッピング
 *
 * ML側（FEATURE_COLS）とDB/UI側でカラム名が異なるものを変換する。
 * 名前の統一は別issueで対応予定。統一後にこのマッピングは削除する。
 */
const ML_TO_DB_COLUMN_MAP: Record<string, string> = {
  // 水道使用量（隔月）
  suido_usage_f1: "waterusage_11to12m_ago",
  suido_usage_f2: "waterusage_9to10m_ago",
  suido_usage_f3: "waterusage_7to8m_ago",
  suido_usage_f4: "waterusage_5to6m_ago",
  suido_usage_f5: "waterusage_3to4m_ago",
  suido_usage_f6: "waterusage_1to2m_ago",
  // 住基系
  juki_residence_flag: "has_juki_registry",
  household_size_juki_residence: "household_size",
  max_age_juki_residence: "max_age",
  over_65_count_juki_residence: "members_over_65",
  under_15_count_juki_residence: "members_under_15",
  residence_duration_juki_residence: "residence_duration",
  num_deaths_juki_residence: "num_deaths",
  num_inmigrants_juki_residence: "num_inmigrants",
  num_outmigrants_relocations_juki_residence: "num_outmigrants_relocations",
};

/**
 * カラム名を表示用に変換する
 * - _odsサフィックスを持つ場合: [追加] プレフィックスを付与（例: 課税標準額_ods → [追加] 課税標準額）
 * - それ以外: column-translations.json で日本語名に変換を試みる
 */
export const toOdsDisplayName = (columnName: string): string => {
  if (columnName.endsWith(ODS_SUFFIX)) {
    return `${ODS_DISPLAY_PREFIX}${columnName.slice(0, -ODS_SUFFIX.length)}`;
  }
  // ML名 → DB名の暫定変換を適用してから日本語化
  const dbColumnName = ML_TO_DB_COLUMN_MAP[columnName] ?? columnName;
  return translateColumnToJapanese(dbColumnName, "building");
};
