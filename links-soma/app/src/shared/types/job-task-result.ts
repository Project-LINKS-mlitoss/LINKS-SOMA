type PreprocessTaskResult = {
  taskResultType: "preprocess";

  joining_rate: string;
  input_source?: string[];
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

export type JobTaskResult =
  | PreprocessTaskResult
  | PreprocessSummaryTaskResult
  | ModelCreateTaskResult
  | JoinCheckTaskResult;
