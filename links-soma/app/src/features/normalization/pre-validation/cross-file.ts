/**
 * クロスファイル参照整合（PV-08）。
 *
 * 名寄せは子データセットのキーで親データセットを引く（例: 水道使用量の水道番号で
 * 水道開閉栓状況を参照）。事後は `water_status.merge(usage, how="left")`（親=水道状況）で、
 * 親に無い子キー（使用量側だけにある水道番号）はマージ結果から落ちる＝その使用量行が
 * 取り込まれない。処理は止まらない（継続）が、データは欠落するので事前に注意で示す。
 *
 * 片側性: 親キーは全件読む（被参照側は確定が要る）、子はサンプリング。
 * 子サンプルの値が親キー全件に無ければ「参照先に存在しない」を確定 issue にできる。
 * 子を打ち切っている限り、後方に不整合があり得るため clear とは言えず unknown。
 * 単一サンプルの検出器（engine の AspectId）と異なり2入力なので別経路で扱う。
 */

import type { SampleColumn, Verdict } from "./types";

/** 事前バリデーションコード（観点マスタ PV-08 / ADR-0027）。 */
export const REFERENCE_PV_CODE = "PV-08";
/** 観点キー。表示名「参照整合」は lang.ts（normalizationPreValidation.labels）で解決。 */
export const REFERENCE_ASPECT_KEY = "reference";

/**
 * 参照整合。子サンプルの非空値が親キー全件に無ければ issue を確定する。
 * 親キーが空（取得不能・空ファイル）なら検証不能として unknown を返す
 * （全件を issue 扱いする偽陽性を避ける）。
 */
export const referenceIntegrity = (
  child: SampleColumn,
  parentKeys: ReadonlySet<string>,
): Verdict => {
  if (parentKeys.size === 0) {
    return { status: "unknown", message: { key: "referenceParentMissing" } };
  }
  for (const v of child.values) {
    if (v !== "" && !parentKeys.has(v)) {
      return {
        status: "issue",
        message: { key: "referenceNotFound", params: { value: v } },
      };
    }
  }
  if (!child.truncated) {
    return { status: "clear", message: { key: "referenceClear" } };
  }
  return { status: "unknown", message: { key: "referenceUnknown" } };
};

/** クロスファイル参照ルール（子→親）。論理キーで持ち、実カラムは実行時に解決する。 */
export type ReferenceRule = {
  /** 子データセット（schemaKey）。 */
  childDataset: string;
  /** 子の参照カラム（論理キー）。 */
  childColumnKey: string;
  /** 親データセット（schemaKey）。 */
  parentDataset: string;
  /** 親の被参照カラム（論理キー）。 */
  parentColumnKey: string;
  /** 失敗時影響（網羅表）。stop=止まる / continue=吸収。 */
  impact?: "stop" | "continue";
};

/**
 * データセット（schemaKey）→ そのデータセットを検証する時に走るクロスファイル参照ルール。
 * 網羅表 PV-08 行に対応する。
 */
export const REFERENCES_BY_DATASET: Record<string, ReferenceRule[]> = {
  // 水道使用量の水道番号は水道開閉栓状況に存在するキーでなければならない。
  // 失敗時影響=継続（NULLマージ）→ impact: continue。
  water_usage: [
    {
      childDataset: "water_usage",
      childColumnKey: "water_supply_number",
      parentDataset: "water_status",
      parentColumnKey: "water_supply_number",
      impact: "continue",
    },
  ],
};

/** 参照を具体値（親ファイル名・実カラム名）に解決した結果。 */
export type ResolvedReference = {
  /** 親ファイル名（フォームの path＝DBディレクトリ基準）。 */
  parentFilename: string;
  /** 親の実カラム名。 */
  parentColumn: string;
  /** 子の実カラム名。 */
  childColumn: string;
  impact?: "stop" | "continue";
};

/** フォーム状態の1データセット分（path とカラムマッピング）。 */
type DatasetState = {
  path?: string;
  columns?: Record<string, string>;
};

/**
 * schemaKey のクロスファイル参照を、フォーム状態から具体値に解決する（純粋）。
 * 親ファイル・親実カラム・子実カラムのいずれかが未確定の参照は捨てる（事後に委ねる）。
 */
export const resolveReferences = (
  schemaKey: string,
  data: Record<string, DatasetState | undefined>,
): ResolvedReference[] =>
  (REFERENCES_BY_DATASET[schemaKey] ?? []).flatMap((ref) => {
    const parent = data[ref.parentDataset];
    const child = data[ref.childDataset];
    const parentFilename = parent?.path;
    const parentColumn = parent?.columns?.[ref.parentColumnKey];
    const childColumn = child?.columns?.[ref.childColumnKey];
    if (!parentFilename || !parentColumn || !childColumn) {
      return [];
    }
    return [{ parentFilename, parentColumn, childColumn, impact: ref.impact }];
  });
