import { isLikelyNonUtf8 } from "../../dataset/util/detect-encoding";
import { readCSVColumnValues } from "../../dataset/util/read-csv-column-values";
import { sampleCSVColumn } from "../../dataset/util/sample-csv-column";
import {
  buildDisplay,
  DATE_ORDER_ASPECT_KEY,
  DATE_ORDER_BY_DATASET,
  DATE_ORDER_PV_CODE,
  dateOrder,
  ENCODING_ASPECT_KEY,
  ENCODING_PV_CODE,
  encodingVerdict,
  REFERENCE_ASPECT_KEY,
  REFERENCE_PV_CODE,
  referenceIntegrity,
  RULES_BY_DATASET,
  runRules,
  toDisplay,
  type PreValidationDisplay,
  type Rule,
  type SampleColumn,
} from "../pre-validation";

/** サンプリング行数（要件正本「1000行レベルで軽量チェック」）。 */
export const SAMPLE_SIZE = 1000;

/** 画面1行分。表示用 + 行 identity と観点キー（行で別列に出すため分離して持つ）。 */
export type PreValidationItem = PreValidationDisplay & {
  /** 行の表示 identity（論理項目名。未解決時は実カラム名にフォールバック）。 */
  column: string;
  /** 観点キー。画面ラベル（「重複」等）は画面側で lang.ts から解決する。 */
  aspectKey: string;
};

/**
 * クロスファイル参照チェック1件分（親ファイルは絶対パスに解決済み）。
 * 親キーは全件・子はサンプリングで issue 側を確定する（参照整合 PV-08）。
 */
export type ReferenceCheck = {
  /** 親ファイルの絶対パス。 */
  parentPath: string;
  /** 親の実カラム名。 */
  parentColumn: string;
  /** 子の実カラム名。 */
  childColumn: string;
  impact?: "stop" | "continue";
};

/**
 * 行の identity に出す論理項目名を解決する。
 * 同じ実カラムに複数の論理項目を割り当てても（誤マッピング時）、行は論理項目で区別できる。
 * 論理ラベルが無ければ実カラム名にフォールバック。
 */
const resolveColumnLabel = (
  columnKey: string | undefined,
  actualColumn: string | undefined,
  columnLabels: Record<string, string>,
): string => (columnKey && columnLabels[columnKey]) || actualColumn || "";

/** カタログの単一カラム検査（サンプリング・三値）。 */
const runColumnChecks = async (
  filePath: string,
  schemaKey: string,
  columns: Record<string, string>,
  columnLabels: Record<string, string>,
): Promise<PreValidationItem[]> => {
  // ユーザーが実カラムに対応づけたルールだけ検査する。未マッピング（空）は行を
  // 出さず事後に委ねる。カラム未選択の初期状態でパネルに空名の保留行を出さない。
  const catalog = (RULES_BY_DATASET[schemaKey] ?? []).filter(
    (c) => columns[c.columnKey],
  );
  if (catalog.length === 0) {
    return [];
  }

  // 論理キーを実カラム名に解決してエンジン用ルールにする（論理キーも保持）
  const rules: Rule[] = catalog.map((c) => ({
    dataset: schemaKey,
    column: columns[c.columnKey],
    columnKey: c.columnKey,
    aspect: c.aspect,
    impact: c.impact,
    min: c.min,
    max: c.max,
  }));

  // 各ルールのカラムをサンプリング（実カラム名未解決なら null）
  const samples = await Promise.all(
    rules.map((rule): Promise<SampleColumn | null> => {
      if (!rule.column) {
        return Promise.resolve(null);
      }
      return sampleCSVColumn(filePath, rule.column, SAMPLE_SIZE);
    }),
  );
  const sampleByRule = new Map<Rule, SampleColumn | null>(
    rules.map((rule, i) => [rule, samples[i]]),
  );

  const results = runRules(rules, (rule) => sampleByRule.get(rule) ?? null);

  return results.map(({ rule, verdict }) => ({
    ...toDisplay({ rule, verdict }),
    column: resolveColumnLabel(rule.columnKey, rule.column, columnLabels),
    aspectKey: rule.aspect,
  }));
};

/** 前後関係（同一ファイル2カラム）。どちらか未マッピングのペアは出さない（PV-10）。 */
const runDateOrderChecks = async (
  filePath: string,
  schemaKey: string,
  columns: Record<string, string>,
  columnLabels: Record<string, string>,
): Promise<PreValidationItem[]> => {
  const pairs = (DATE_ORDER_BY_DATASET[schemaKey] ?? []).flatMap((r) => {
    const earlier = columns[r.earlierColumnKey];
    const later = columns[r.laterColumnKey];
    if (!earlier || !later) {
      return [];
    }
    return [
      {
        earlier,
        later,
        earlierKey: r.earlierColumnKey,
        laterKey: r.laterColumnKey,
        impact: r.impact,
      },
    ];
  });
  const items = await Promise.all(
    pairs.map(async (p): Promise<PreValidationItem | null> => {
      const [earlierSample, laterSample] = await Promise.all([
        sampleCSVColumn(filePath, p.earlier, SAMPLE_SIZE),
        sampleCSVColumn(filePath, p.later, SAMPLE_SIZE),
      ]);
      if (earlierSample === null || laterSample === null) {
        return null;
      }
      const verdict = dateOrder(earlierSample, laterSample);
      // 行 identity は論理項目名のペア（誤マッピング時も区別できるように）
      const earlierLabel = resolveColumnLabel(
        p.earlierKey,
        p.earlier,
        columnLabels,
      );
      const laterLabel = resolveColumnLabel(p.laterKey, p.later, columnLabels);
      return {
        ...buildDisplay(DATE_ORDER_PV_CODE, p.impact, verdict),
        column: `${earlierLabel}・${laterLabel}`,
        aspectKey: DATE_ORDER_ASPECT_KEY,
      };
    }),
  );
  return items.filter((item): item is PreValidationItem => item !== null);
};

/** クロスファイル参照整合（親全件 × 子サンプル）。子カラム未解決の参照は出さない。 */
const runReferenceChecks = async (
  filePath: string,
  references: ReferenceCheck[],
): Promise<PreValidationItem[]> => {
  const items = await Promise.all(
    references.map(async (ref): Promise<PreValidationItem | null> => {
      const childSample = await sampleCSVColumn(
        filePath,
        ref.childColumn,
        SAMPLE_SIZE,
      );
      if (childSample === null) {
        return null;
      }
      const parentKeys = new Set(
        await readCSVColumnValues(ref.parentPath, ref.parentColumn),
      );
      const verdict = referenceIntegrity(childSample, parentKeys);
      return {
        ...buildDisplay(REFERENCE_PV_CODE, ref.impact, verdict),
        column: ref.childColumn,
        aspectKey: REFERENCE_ASPECT_KEY,
      };
    }),
  );
  return items.filter((item): item is PreValidationItem => item !== null);
};

/**
 * 事前軽量チェックのコア（絶対パスを受け取る・Electron非依存でテスト可能）。
 * カタログ・参照とも該当が無ければ空配列（事後に委ねる）。
 */
export const runPreValidation = async (
  filePath: string,
  schemaKey: string,
  columns: Record<string, string>,
  references: ReferenceCheck[] = [],
  /** 論理カラムキー → 論理項目名（画面の行 identity）。未指定は実カラム名にフォールバック。 */
  columnLabels: Record<string, string> = {},
): Promise<PreValidationItem[]> => {
  // 文字コード（PV-01）を最初に確認する。非UTF-8 は文字化けで列・参照チェックが
  // 誤動作する（ヘッダー照合が外れ無言 unknown 化する）ため、文字コード警告のみ出し
  // 列・参照チェックは事後に委ねる。厳密な特定・変換は処理本体（Python chardet）。
  // CSV/TXT のみ対象（gpkg/shp 等のバイナリは UTF-8 でないのが正常＝誤検出を防ぐ）。
  if (/\.(csv|txt)$/i.test(filePath) && (await isLikelyNonUtf8(filePath))) {
    return [
      {
        ...buildDisplay(ENCODING_PV_CODE, "continue", encodingVerdict(true)),
        column: "",
        aspectKey: ENCODING_ASPECT_KEY,
      },
    ];
  }
  const [columnItems, referenceItems, dateOrderItems] = await Promise.all([
    runColumnChecks(filePath, schemaKey, columns, columnLabels),
    runReferenceChecks(filePath, references),
    runDateOrderChecks(filePath, schemaKey, columns, columnLabels),
  ]);
  return [...columnItems, ...referenceItems, ...dateOrderItems];
};
