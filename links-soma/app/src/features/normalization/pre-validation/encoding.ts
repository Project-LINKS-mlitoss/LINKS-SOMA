/**
 * 文字コード（PV-01）。ファイル単位の別経路。
 *
 * 読み込み本体は UTF-8 固定なので、非UTF-8 ファイルは文字化けし、ヘッダー照合が
 * 外れて全列が無言 unknown 化する。「明らかに非UTF-8（UTF-8として読めない）」を
 * issue で確定し、厳密な特定・自動変換は処理本体（Python chardet・FR007）に委ねる。
 *
 * 単一サンプルの検出器（engine の AspectId）と異なりファイル単位なので別経路で扱う
 * （参照整合 PV-08 と同じ位置づけ）。判定の入力は `detect-encoding.ts` の真偽値。
 */

import type { Verdict } from "./types";

/** 事前バリデーションコード（観点マスタ PV-01 / ADR-0027）。 */
export const ENCODING_PV_CODE = "PV-01";
/** 観点キー。表示名「文字コード」は lang.ts（normalizationPreValidation.labels）で解決。 */
export const ENCODING_ASPECT_KEY = "encoding";

/** 非UTF-8 なら issue（文字コード確認を促す）、UTF-8 なら clear。 */
export const encodingVerdict = (nonUtf8: boolean): Verdict =>
  nonUtf8
    ? { status: "issue", message: { key: "encodingNotUtf8" } }
    : { status: "clear" };
