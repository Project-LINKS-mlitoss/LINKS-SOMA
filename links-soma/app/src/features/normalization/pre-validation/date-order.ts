/**
 * 前後関係（PV-10・操作補助）。同一行の2つの日付カラムの順序を検査する。
 *
 * 用途は「データに逆転が出るか」ではなく**カラム取り違えガード**。開栓日↔閉栓日の
 * 誤マッピングはほぼ全行が逆転して発火する。日付形式（PV-09）は両方が妥当な日付なら
 * 素通りするため、取り違えを捕まえられるのは前後関係だけ。Python は逆転を許容する
 * （`add_heisen_flag` 等）ため純・操作補助で、値域（PV-05）と同種。
 *
 * 単一サンプルの検出器（engine の AspectId）と異なり2カラム同一行なので別経路で扱う。
 */

import type { SampleColumn, Verdict } from "./types";

/** 事前バリデーションコード（観点マスタ PV-10 / ADR-0027）。 */
export const DATE_ORDER_PV_CODE = "PV-10";
/** 観点キー。表示名「前後関係」は lang.ts（normalizationPreValidation.labels）で解決。 */
export const DATE_ORDER_ASPECT_KEY = "date_order";

/**
 * 比較可能な日付（yyyymmdd / yyyy-mm-dd / yyyy/mm/dd 等）を整数 yyyymmdd に正規化。
 * 和暦・「yyyy年mm月dd日」など比較が曖昧な形式は null（その行は比較しない）。
 */
const toComparable = (v: string): number | null => {
  const s = v.trim();
  if (/^\d{8}$/.test(s)) {
    return Number(s);
  }
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s);
  if (m) {
    return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  }
  return null;
};

/**
 * 前後関係。同一行で earlier > later（逆転）の行があれば issue を確定する。
 * 比較できない行（欠損・和暦等）は飛ばす（欠損・日付形式の責務）。打ち切りで
 * 逆転が無ければ後方にあり得るため unknown、全件読了なら clear。
 */
export const dateOrder = (
  earlier: SampleColumn,
  later: SampleColumn,
): Verdict => {
  const n = Math.min(earlier.values.length, later.values.length);
  for (let i = 0; i < n; i++) {
    const a = toComparable(earlier.values[i]);
    const b = toComparable(later.values[i]);
    if (a !== null && b !== null && a > b) {
      return {
        status: "issue",
        message: {
          key: "dateOrderReversed",
          params: { earlier: earlier.values[i], later: later.values[i] },
        },
      };
    }
  }
  if (!earlier.truncated && !later.truncated) {
    return { status: "clear" };
  }
  return { status: "unknown", message: { key: "dateOrderUnknown" } };
};

/** 前後関係ルール（earlier ≤ later）。論理キーで持ち、実カラムは実行時に解決する。 */
export type DateOrderRule = {
  /** 先行すべき日付カラム（論理キー）。 */
  earlierColumnKey: string;
  /** 後続すべき日付カラム（論理キー）。 */
  laterColumnKey: string;
  /** 失敗時影響（網羅表）。stop=止まる / continue=吸収。 */
  impact?: "stop" | "continue";
};

/**
 * データセット（schemaKey）→ 前後関係ルール。同一ファイル2カラムなので親解決は不要。
 * 網羅表 PV-10 行に対応する。
 */
export const DATE_ORDER_BY_DATASET: Record<string, DateOrderRule[]> = {
  // 開栓日 ≤ 閉栓日。取り違えると全行逆転で発火する（カラム取り違えガード）。
  water_status: [
    {
      earlierColumnKey: "water_connection_date",
      laterColumnKey: "water_disconnection_date",
      impact: "continue",
    },
  ],
};
