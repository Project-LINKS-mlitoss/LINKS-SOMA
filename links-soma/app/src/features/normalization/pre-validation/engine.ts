/**
 * 事前軽量チェックのエンジン（純粋・ルール駆動）。
 *
 * ルールの aspect で検出器に振り分けるだけ。検査追加 = ルール追加 + 検出器追加で、
 * エンジン本体は不変（疎結合の肝）。サンプル取得（fs）は呼び出し側が供給する。
 */

import { DETECTORS } from "./detectors";
import type { Rule, SampleColumn, Verdict } from "./types";

export type RuleResult = { rule: Rule; verdict: Verdict };

/**
 * @param getColumn ルール対象カラムのサンプルを返す。取得不能なら null。
 */
export const runRules = (
  rules: Rule[],
  getColumn: (rule: Rule) => SampleColumn | null,
): RuleResult[] =>
  rules.map((rule) => {
    const sample = getColumn(rule);
    const verdict: Verdict =
      sample === null
        ? { status: "unknown", reason: "対象カラムを取得できなかった" }
        : DETECTORS[rule.aspect](sample, rule);
    return { rule, verdict };
  });
