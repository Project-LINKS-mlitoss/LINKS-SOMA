/**
 * 名寄せの事前軽量チェック（FR004-007）の型定義。
 *
 * 設計の核（SSOT: Notion「FR004-007 統合要件定義 §実装層の方針」）:
 * - 事前軽量チェックは「目安」。最終権威は事後チェック（処理本体）であり、
 *   事前で確定できないものは事後に委ね、ここで処理を落とさない。
 * - サンプリング（先頭N行）で走るため、検査は「片側」しか確定できない。
 *   どちらの側を確定できるかは観点ごとに異なる（一意性は issue 側、
 *   期間カバレッジは clear 側）。確定できない側は unknown を返し事後へ委譲する。
 */

/**
 * 文言の参照。ドメイン（検出器）は prose を持たず、画面側（lang.ts）で文章化する
 * ための「キー＋差し込み値」だけを返せる。メイン/レンダラー境界を越えず、文言を
 * lang.ts に集約するための仕組み（移行中は prose の detail/reason も併用可）。
 */
export type MessageRef = {
  /** lang.ts のメッセージキー。 */
  key: string;
  /** テンプレートの差し込み値（`{value}` 等）。 */
  params?: Record<string, string | number>;
};

/**
 * 検査結果。三値。unknown は「事後チェックに委ねる」を意味する。
 * 文言は prose（detail/reason）か、lang.ts 解決用の message（どちらか／併用可）で返す。
 */
export type Verdict =
  | { status: "issue"; detail?: string; message?: MessageRef }
  | { status: "clear"; detail?: string; message?: MessageRef }
  | { status: "unknown"; reason?: string; message?: MessageRef };

/**
 * 観点 = カラム検出器の種類。網羅表「観点」列に対応（実装した分だけ増える）。
 * ファイル単位の検査（文字コード・ファイル形式）はカラムを取らないため、エンジンの
 * AspectId ではなく `file-checks.ts` 側で扱う。
 */
export type AspectId =
  | "uniqueness"
  | "data_type_numeric"
  | "value_range"
  | "missing_value"
  | "date_format";

/**
 * ルール = データ駆動の検査定義。網羅表の1行に相当する。
 * 「どのデータセットのどのカラムに何の観点を当てるか」と観点ごとのパラメータを持ち、
 * 検査ロジックは持たない（エンジンが aspect で検出器に振り分ける）。
 */
export type Rule = {
  /** schemaKey（water_status 等）。 */
  dataset: string;
  /** 検査対象カラム（実カラム名）。ファイル/データセット単位の検査では undefined。 */
  column?: string;
  /** 論理カラムキー（water_disconnection_date 等）。画面の行 identity を論理項目名で出すために保持。 */
  columnKey?: string;
  /** 観点。 */
  aspect: AspectId;
  /**
   * 失敗時影響（網羅表「失敗時影響」列）。issue を画面でどの重さで出すかを決める。
   * stop=処理が止まる（エラー） / continue=止まらず吸収（注意）。未指定は注意扱い。
   */
  impact?: "stop" | "continue";
  /** 値域（value_range）の下限・上限（両端含む）。 */
  min?: number;
  max?: number;
};

/**
 * サンプリングされた1カラム分の値。
 * truncated=false なら全件読了で、検出器は両側を確定できる（サンプリングの片側性が外れる）。
 */
export type SampleColumn = {
  /** サンプリングした値（出現順・空文字を含む）。 */
  values: string[];
  /** 全件を読み切れず打ち切ったか。true=サンプリング、false=全件。 */
  truncated: boolean;
};

/**
 * 検出器 = 純粋関数。サンプルと（パラメータ参照用の）ルールを受け取り Verdict を返す。
 * fs/IO は扱わない。多くの検出器は rule を使わないが、値域・期間カバレッジは
 * rule のパラメータを読む。
 */
export type Detector = (sample: SampleColumn, rule: Rule) => Verdict;
