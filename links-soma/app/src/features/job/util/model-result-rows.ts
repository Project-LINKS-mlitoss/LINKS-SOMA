/**
 * モデル構築の処理結果画面に出ている評価指標を、検証情報ダウンロード（NR007）の
 * セクションへ整形する。
 *
 * 画面のカード1枚 = ファイルの1セクション。値の書式（パーセント・Lift・閾値）は
 * 画面と共有する。画面とファイルが別々に数値を組み立てると、丸め方が食い違ったまま
 * 同じ指標が2通りで流通するため。
 */

import { lang } from "../../../shared/config/lang";
import { type ModelCreateTaskResult } from "../../../shared/types/job-task-result";
import { toOdsDisplayName } from "../../../shared/types/optional-data-source";
import { type VerificationSection } from "./verification-text";

const m = lang.components.modelResult;

/** 値が未記録のときの表示。画面のテーブルと同じ形にする */
export const EMPTY_VALUE = "--";

/** 特徴量重要度が上位のみに絞られる件数。Python 側の切り出し件数と一致する */
export const IMPORTANT_COLUMNS_DISPLAY_LIMIT = 20;

/** 比率（0〜1）をパーセント表示にする。E021 が比率で返すため表示時に×100する */
export const formatRatioAsPercent = (
  value: string | undefined,
  decimals = 1,
): string => {
  if (!value) return EMPTY_VALUE;
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return EMPTY_VALUE;
  return `${(num * 100).toFixed(decimals)}%`;
};

/** Lift（ランダム抽出比）の表示。倍率であることが読めるよう `x` を付ける */
export const formatLift = (value: string | undefined): string => {
  if (!value) return EMPTY_VALUE;
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return EMPTY_VALUE;
  return `${num.toFixed(2)}x`;
};

/** 判定閾値スコアの表示。候補件数の境目を再現できるよう小数4桁まで残す */
export const formatThresholdScore = (value: string | undefined): string => {
  if (!value) return EMPTY_VALUE;
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return EMPTY_VALUE;
  return num.toFixed(4);
};

/** 候補件数の表示 */
export const formatCandidateCount = (value: string | undefined): string => {
  if (!value) return EMPTY_VALUE;
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return EMPTY_VALUE;
  return `${num.toLocaleString()}件`;
};

/** 特徴量重要度の値の表示 */
export const formatImportance = (value: string | undefined): string => {
  if (!value) return EMPTY_VALUE;
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return EMPTY_VALUE;
  return num.toFixed(1);
};

/** 特徴量重要度の見出し。上限件数ちょうどなら絞り込みが起きたとみなす */
export const importantColumnsTitle = (count: number): string =>
  count === IMPORTANT_COLUMNS_DISPLAY_LIMIT
    ? m.importantColumnsSectionTopN(count)
    : m.importantColumnsSection;

/** Precision@K の K と、結果オブジェクト上のキーの対応（画面の表と同じ並び） */
const PRECISION_KEYS: [number, keyof ModelCreateTaskResult][] = [
  [100, "precisionAt100"],
  [500, "precisionAt500"],
  [1000, "precisionAt1000"],
  [3000, "precisionAt3000"],
  [5000, "precisionAt5000"],
];

/** Lift の K と、結果オブジェクト上のキーの対応（画面の表と同じ並び） */
const LIFT_KEYS: [number, keyof ModelCreateTaskResult][] = [
  [1000, "liftAt1000"],
  [5000, "liftAt5000"],
];

/**
 * モデル構築の結果をセクション群へ展開する。
 *
 * モデル名・メモは結果オブジェクトでなく model_files 由来のため引数で受け取る。
 * 未保存のモデルには名前が無く、その場合は行を作らない。
 */
export const toModelResultSections = ({
  result,
  modelFileName,
  modelFileNote,
}: {
  result: ModelCreateTaskResult | null | undefined;
  modelFileName?: string | null;
  modelFileNote?: string | null;
}): VerificationSection[] => {
  const sections: VerificationSection[] = [];

  const modelRows: [string, string][] = [];
  if (modelFileName) modelRows.push([m.modelFileName, modelFileName]);
  if (modelFileNote) modelRows.push([m.modelFileNote, modelFileNote]);
  if (modelRows.length) {
    sections.push({ title: m.modelSection, rows: modelRows });
  }

  if (!result) return sections;

  sections.push({
    title: m.precisionSection,
    rows: PRECISION_KEYS.map(([k, key]): [string, string] => [
      m.topK(k),
      formatRatioAsPercent(result[key] as string | undefined),
    ]),
  });

  sections.push({
    title: m.liftSection,
    rows: LIFT_KEYS.map(([k, key]): [string, string] => [
      m.topK(k),
      formatLift(result[key] as string | undefined),
    ]),
  });

  sections.push({
    title: m.thresholdSection,
    rows: [
      [m.recallTarget, formatRatioAsPercent(result.recallTarget)],
      [m.thresholdScore, formatThresholdScore(result.threshold)],
      [m.candidateCount, formatCandidateCount(result.candidateCount)],
      [m.candidateRatio, formatRatioAsPercent(result.candidateRatio)],
    ],
  });

  const importantColumns = result.important_columns ?? [];
  if (importantColumns.length) {
    sections.push({
      title: importantColumnsTitle(importantColumns.length),
      rows: importantColumns.map((item): [string, string] => [
        toOdsDisplayName(item.column),
        formatImportance(item.value),
      ]),
    });
  }

  return sections;
};
