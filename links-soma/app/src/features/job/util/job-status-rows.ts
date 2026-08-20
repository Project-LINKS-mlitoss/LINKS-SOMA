/**
 * ジョブの状態を検証情報ダウンロードの先頭セクションへ整形する。
 *
 * 実行中に押されたファイルには、途中までの件数・集計がそのまま載る。状態行が無いと
 * 受け取った側は完了した処理の結果と区別できない。失敗・下書きも同じ理由で書き出す。
 */

import { type SelectJob } from "../../../db/schema";
import { lang } from "../../../shared/config/lang";
import { type VerificationSection } from "./verification-text";

const l = lang.components["job-parameters-section"];

/** 実行中を表す status（DB は空文字、未記録は null）。どちらも完了していない */
const PROCESSING_KEY = "processing";

/** status を表示ラベルへ解決する。complete / error / draft 以外は実行中扱い */
export const jobStatusLabel = (status: SelectJob["status"]): string =>
  l.jobStatusLabels[status || PROCESSING_KEY] ??
  l.jobStatusLabels[PROCESSING_KEY];

/** ジョブの状態セクション。3画面の検証情報で先頭に置く */
export const toJobStatusSection = (job: SelectJob): VerificationSection => ({
  title: l.jobStatusSection,
  rows: [[l.jobStatusLabel, jobStatusLabel(job.status)]],
});
