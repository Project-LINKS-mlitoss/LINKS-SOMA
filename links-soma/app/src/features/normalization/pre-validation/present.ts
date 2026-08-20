/**
 * 検査結果（三値）を画面表示の「重さ」に変換する（純粋）。
 *
 * 表示の意味づけ（決定事項）:
 * - clear → ok / unknown → pending（控えめ） /
 *   issue → 網羅表「失敗時影響」で出し分け（stop=error / continue=warn）
 *
 * message は検出器（ドメイン層）が返す文言をそのまま通す（UIコピーを直書きしない）。
 * スタイリング・控えめ表現は UI 層の責務。ここは重さと文言の橋渡しだけを担う。
 */

import type { RuleResult } from "./engine";
import { PV_CODE } from "./pv-codes";
import type { Rule, Verdict } from "./types";

/** 画面表示の重さ。error/warn=要対応、ok=問題なし、pending=処理時に確定（控えめ）。 */
export type DisplayStatus = "error" | "warn" | "ok" | "pending";

export type PreValidationDisplay = {
  /** 事前バリデーションコード（PV-NN）。 */
  code: string;
  /** 表示の重さ。 */
  status: DisplayStatus;
  /** 補足文（prose）。lang.ts 移行済みの観点では空で、messageKey 側を使う。 */
  message: string;
  /** lang.ts のメッセージキー（あれば画面側で文章化し、message より優先）。 */
  messageKey?: string;
  /** テンプレート差し込み値。 */
  messageParams?: Record<string, string | number>;
};

/**
 * 三値 + 失敗時影響 → 表示の重さと文言。AspectId 経路（toDisplay）と
 * クロスファイル経路（参照整合）の両方が使う橋渡し。
 */
export const buildDisplay = (
  code: string,
  impact: Rule["impact"],
  verdict: Verdict,
): PreValidationDisplay => {
  // lang.ts 解決用の参照（あれば画面側で文章化）。prose とは併用可。
  const ref = verdict.message
    ? {
        messageKey: verdict.message.key,
        messageParams: verdict.message.params,
      }
    : {};
  if (verdict.status === "clear") {
    return { code, status: "ok", message: verdict.detail ?? "", ...ref };
  }
  if (verdict.status === "unknown") {
    return { code, status: "pending", message: verdict.reason ?? "", ...ref };
  }
  return {
    code,
    status: impact === "stop" ? "error" : "warn",
    message: verdict.detail ?? "",
    ...ref,
  };
};

export const toDisplay = ({
  rule,
  verdict,
}: RuleResult): PreValidationDisplay =>
  buildDisplay(PV_CODE[rule.aspect], rule.impact, verdict);
