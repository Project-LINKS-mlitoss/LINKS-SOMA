/**
 * 住所の表記ゆれチェック関連の型定義
 */

import { type JoinCheckTarget } from "../../../../../shared/types/job-parameters";

/** 未結合データの候補情報（水道データ側の候補） */
type UnmatchedCandidate = {
  /** 水道データ側の候補住所（大字レベル） */
  address: string;
  /** 水道データ側の件数（元データの大字住所に集約されたレコード数） */
  count: number;
};

/** 未結合データの詳細 */
export type UnmatchedRecord = {
  /** 各データセット側の住所（結合できなかった住所） */
  sourceAddress: string;
  /** 住所グループ内の件数（元データの一意住所数） */
  sourceCount: number;
  /** 水道データ側のマッチング候補（類似度順） */
  candidates: UnmatchedCandidate[];
};

/** タスクの処理状態 */
export type TaskStatus = "pending" | "running" | "complete" | "error";

/** 各データセットペアの結合結果 */
export type JoinResult = {
  /** 対象データセット */
  target: JoinCheckTarget;
  /** 処理状態 */
  status: TaskStatus;
  /** 未結合データの詳細 - 完了時のみ有効 */
  unmatchedRecords: UnmatchedRecord[];
  /** エラーメッセージ - エラー時のみ有効 */
  errorMessage?: string;
};

/** ダイアログの状態 */
export type DialogState = "idle" | "checking" | "completed";

/** データセット情報（パス・住所カラム名） */
export type DatasetInfo = {
  /** ファイルパス（UUID.csv） */
  path: string;
  /** 住所カラム名 */
  addressColumn: string;
};

/** チェック対象の定義（各データセット → 水道データの方向で住所の表記ゆれチェック） */
export const CHECK_TARGETS: { key: JoinCheckTarget; label: string }[] = [
  { key: "resident_registry", label: "住民基本台帳" },
  { key: "building_registry", label: "登記情報" },
  { key: "geocoding", label: "ジオコーディング" },
  { key: "building_type_determination", label: "処理対象選定用データ" },
  { key: "vacant_house", label: "空き家調査結果" },
  { key: "optional_data_source", label: "建物関連データ" },
];

/** 未結合レコードの表示上限 */
export const DISPLAY_LIMIT = 100;

/** 候補ありレコードを件数降順で抽出する（表示・CSV共通） */
export const filterWithCandidates = (
  records: UnmatchedRecord[],
): UnmatchedRecord[] =>
  records
    .filter((r) => r.candidates.length > 0)
    .sort((a, b) => b.sourceCount - a.sourceCount);
