type PreprocessTaskResult = {
  taskResultType: "preprocess";

  joining_rate: string;
  /** 結合元の説明。Python は1本の文字列を書き込む（配列を書く経路も残る） */
  input_source?: string[] | string;
  success_rate?: string;
};

/** 前処理サマリー結果 */
export type PreprocessSummaryTaskResult = {
  taskResultType: "preprocess_summary";

  /** 名寄せ処理済データ（推定対象）の総件数 */
  estimation_target_total_count: number;

  /** レコードの組み合わせ別 */
  record_combinations: {
    has_water_supply: boolean; // 水道開閉栓状況
    has_juki_registry: boolean; // 住民基本台帳
    has_touki_registry: boolean; // 登記情報
    percentage: number;
    count: number;
  }[];
  record_combinations_total: number;

  /** 家屋種別（段階的に更新されるためプロパティはオプショナル） */
  building_type_breakdown?: {
    user_specified?: { percentage: number; count: number };
    unknown?: { percentage: number; count: number };
  };
  building_type_breakdown_total: number;

  /** 地図表示別（段階的に更新されるためプロパティはオプショナル） */
  building_polygon_breakdown?: {
    with_polygon?: { percentage: number; count: number };
    without_polygon?: { percentage: number; count: number };
    excluded_from_display?: { percentage: number; count: number };
  };
  building_polygon_breakdown_total: number;
};

export type ModelCreateTaskResult = {
  taskResultType: "model_create";

  precisionAt100: string; // Precision@100
  precisionAt500: string; // Precision@500
  precisionAt1000: string; // Precision@1000
  precisionAt3000: string; // Precision@3000
  precisionAt5000: string; // Precision@5000
  liftAt1000: string; // Lift@1000
  liftAt5000: string; // Lift@5000
  recallTarget: string; // 再現率目標値（%）
  threshold: string; // 判定閾値スコア
  candidateCount: string; // 候補件数
  candidateRatio: string; // 候補割合
  important_columns: { column: string; value: string }[];

  /** モデル構築処理全体（データ読込〜モデル保存）の所要秒数。NR007検証用 */
  durationTotalSec?: string;
  /** モデル学習（PU Bagging）の所要秒数。NR007検証用 */
  durationTrainingSec?: string;
};

/**
 * 段階別処理時間の検証情報（NR007）。
 * 名寄せ・推定の段階別 duration を保持する。段階構成はパイプラインで異なる
 * （名寄せ: record_linkage / e015 / e016、推定: e022 / e032）ため、固定フィールドでなく
 * 可変長の stages 配列で持つ。表示ラベルは key から lang.ts 側で解決する。
 */
export type StageTimingTaskResult = {
  taskResultType: "stage_timing";

  /** 各段階の所要秒数（実行順）。key はパイプライン内のステージ識別子 */
  stages: { key: string; durationSec: string }[];
  /** プロセス内処理全体（全段階）の所要秒数 */
  totalSec: string;
};

/** 住所の表記ゆれチェック結果（IF005） */
export type JoinCheckTaskResult = {
  taskResultType: "join_check";

  /** チェック対象のキー */
  target: string;
  /** 未結合レコード一覧 */
  unmatchedRecords: {
    /** 各データセット側の住所（大字レベル） */
    sourceAddress: string;
    /** 住所グループ内の件数（元データの大字住所に集約されたレコード数） */
    sourceCount: number;
    /** 水道データ側の候補（最大10件） */
    candidates: {
      address: string;
      /** 水道データ側の件数（元データの大字住所に集約されたレコード数） */
      count: number;
    }[];
  }[];
};

/**
 * エラーの修正方法（FR006 / #1786）。マニュアル相当の直し方をアプリ内に内蔵する。
 * Python の error_fix_guides が表示用コードごとに持ち、guide のあるコードだけ付与される。
 */
export type FixGuide = {
  /** 何が問題か（1文） */
  what: string;
  /** 受理できる形式（箇条書き） */
  accepted?: string[];
  /** 修正前→修正後の対 */
  examples?: { before: string; after: string }[];
};

/**
 * エラー詳細（FR006・責任分界＋次アクション）。
 * Python の error_registry が job_task の result に相乗りさせる（build_error_result）。
 */
export type ErrorDetail = {
  /** 誰が直すか: 自治体修正 / 開発者に相談 / 状況依存 */
  responsibility: string;
  /** 次に何をすべきか（責任分界から導く定型文） */
  next_action: string;
  /** 表示用コード（例: E-0001）。未付番なら空文字 */
  display_code: string;
  /** 修正方法。マニュアル相当の直し方を持つコードのみ付与（FR006 / #1786） */
  fix_guide?: FixGuide;
};

export type JobTaskResult = (
  | PreprocessTaskResult
  | PreprocessSummaryTaskResult
  | ModelCreateTaskResult
  | StageTimingTaskResult
  | JoinCheckTaskResult
  | { taskResultType?: undefined }
) & {
  /** エラー時のみ付与。責任分界・次アクションをUI表示する（FR006） */
  error_detail?: ErrorDetail;
};
