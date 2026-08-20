/**
 * 事前軽量チェックの検出器（純粋関数）。
 *
 * 各検出器はサンプルから「確定できる片側」だけを返す。確定できない側は
 * unknown を返し、事後チェック（処理本体）に委ねる（= 事前で落とさない）。
 */

import type {
  AspectId,
  Detector,
  MessageRef,
  SampleColumn,
  Verdict,
} from "./types";

/** 空でない値だけを残す（欠損は別観点の責務）。 */
const nonEmpty = (values: string[]): string[] => values.filter((v) => v !== "");

/**
 * 一意性。確定できる片側は「issue（重複あり）」。
 *
 * サンプル内に重複が出れば全体も重複ありなので確定 issue。重複が無くても、
 * 打ち切っている限り後方に重複があり得るため clear とは言えず unknown。
 * 全件読了（truncated=false）なら clear も確定できる。
 */
export const uniqueness = (sample: SampleColumn): Verdict => {
  const values = nonEmpty(sample.values);
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      // 文言は lang.ts（normalizationPreValidation.messages）で解決する。
      return {
        status: "issue",
        message: { key: "uniquenessDuplicate", params: { value: v } },
      };
    }
    seen.add(v);
  }
  if (!sample.truncated) {
    return { status: "clear", message: { key: "uniquenessClear" } };
  }
  return { status: "unknown", message: { key: "uniquenessUnknown" } };
};

/**
 * 片側性の汎用検出器: サンプル内に「不正な値」があれば issue を確定する。
 * 全件読了で不正なしなら clear、打ち切りで不正なしなら unknown（事後へ委譲）。
 * 型一致・値域・日付形式・複合形式はこの述語版で表現する（網羅表の同型観点を統合）。
 */
const findBadValue = (
  sample: SampleColumn,
  isBad: (value: string) => boolean,
  issueMessage: (value: string) => MessageRef,
): Verdict => {
  for (const v of nonEmpty(sample.values)) {
    if (isBad(v)) {
      return { status: "issue", message: issueMessage(v) };
    }
  }
  if (!sample.truncated) {
    return { status: "clear" };
  }
  return { status: "unknown", message: { key: "noMatchUnknown" } };
};

/**
 * データ型一致（数値）。数値に解釈できない値を検出する。
 * Python の `pd.to_numeric(errors="coerce")` に合わせ、JS の `Number()` が通す
 * 16進/8進/2進リテラル（`0x10` 等）は Python が NaN 化するため不正扱いにする。
 */
export const dataTypeNumeric = (sample: SampleColumn): Verdict =>
  findBadValue(
    sample,
    (v) => Number.isNaN(Number(v)) || /^\s*[+-]?0[xXoObB]/.test(v),
    (v) => ({ key: "numericInvalid", params: { value: v } }),
  );

/** 値域。min〜max（両端含む）の外れ値を検出する。 */
export const valueRange = (
  sample: SampleColumn,
  min: number,
  max: number,
): Verdict =>
  findBadValue(
    sample,
    (v) => {
      const n = Number(v);
      return Number.isNaN(n) || n < min || n > max;
    },
    (v) => ({ key: "valueRangeOut", params: { min, max, value: v } }),
  );

/**
 * Python パイプライン（E013 / water.py / juki.py）が受理する日付形式。
 * JS の `new Date()` は yyyymmdd・和暦・「yyyy年mm月dd日」を NaN にしてしまい、
 * 実データ（正準は8桁 yyyymmdd）を誤検出するため、Python 準拠の形で判定する。
 * 目安なので狼少年を避け、いずれの既知形式にも当てはまらない値だけを不正とする。
 */
const DATE_PATTERNS: RegExp[] = [
  /^\d{8}$/, // yyyymmdd（正準）
  /^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/, // yyyy-mm-dd / yyyy/mm/dd
  /^\d{4}年\d{1,2}月\d{1,2}日$/, // 和暦表記でない日本語年月日
  /^(令和|平成|昭和|大正|[RHST])\s?\d/, // 和暦
];

/** 日付形式。Python が受理する既知形式のいずれにも当てはまらない値を検出する。 */
export const dateFormat = (sample: SampleColumn): Verdict =>
  findBadValue(
    sample,
    (v) => !DATE_PATTERNS.some((re) => re.test(v)),
    (v) => ({ key: "dateFormatInvalid", params: { value: v } }),
  );

/** 必須欠損なし。空文字（欠損）を検出する。findBadValue は欠損を除くため別実装。 */
export const missingValue = (sample: SampleColumn): Verdict => {
  if (sample.values.some((v) => v === "")) {
    return { status: "issue", message: { key: "missingValueDetected" } };
  }
  if (!sample.truncated) {
    return { status: "clear" };
  }
  return { status: "unknown", message: { key: "missingValueUnknown" } };
};

/** 観点 → 検出器。エンジンはこのレジストリ経由で振り分ける。 */
export const DETECTORS: Record<AspectId, Detector> = {
  uniqueness,
  data_type_numeric: dataTypeNumeric,
  value_range: (sample, rule) =>
    valueRange(sample, rule.min ?? -Infinity, rule.max ?? Infinity),
  missing_value: missingValue,
  date_format: dateFormat,
};
