/**
 * カラムの参照型（チャート・テーブル・フィルターで使用）
 * features/bi の GroupConditionValue["referenceColumnType"] と同一の型を独立定義
 */
export type ChartColumnType =
  | "text"
  | "integer"
  | "float"
  | "integerRange"
  | "floatRange"
  | "date"
  | "dateRange"
  | "boolean";
