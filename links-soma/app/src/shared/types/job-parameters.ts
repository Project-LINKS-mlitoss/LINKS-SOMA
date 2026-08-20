import { type z } from "zod";
import { type schema as modelCreateSchema } from "../../features/model/hooks/use-form-model-create";
import { type schema as normalizationSchema } from "../../features/normalization/hooks/use-form-normalization";
import { type schema as resultSchema } from "../../features/evaluation/hooks/use-form-data-evaluate";

type BaseParameters = {
  output_path?: string; // ファイル出力が必要な場合のみ指定
  database_path: string; // SQLite データベースファイルのパス
};

export type PreprocessParameters = { parameterType: "preprocess" } & z.infer<
  typeof normalizationSchema
>;

/**
 * 下書き状態のPreprocessParameters
 * 通常のPreprocessParametersに加えて、住所の表記ゆれチェックjobの参照を保持
 * 注: 下書き状態ではdatabase_path/output_pathは含まない（実行時に追加される）
 */
export type DraftPreprocessParameters = PreprocessParameters & {
  /** 住所の表記ゆれチェックjobのID（住所の表記ゆれチェック実行済みの場合） */
  joinCheckJobId?: number;
  /** 手動スキップしたステップのインデックス */
  manuallySkippedSteps?: number[];
};

export type ModelCreateParameters = { parameterType: "ml" } & z.infer<
  typeof modelCreateSchema
>;
export type ResultParameters = { parameterType: "result" } & z.infer<
  typeof resultSchema
>;

export type ExportParameters = {
  parameterType: "export";
} & {
  output_file_type: string;
  output_coordinate: string;
  target_unit?: "building" | "area";
  data_set_results_id?: number;
  reference_date?: string; // データセット管理からダウンロードする場合に必要
  view_id?: number; // 参照されるビューがある場合
};

/** 住所の表記ゆれチェック対象のデータセットキー */
export type JoinCheckTarget =
  | "resident_registry"
  | "building_registry"
  | "geocoding"
  | "building_type_determination"
  | "vacant_house"
  | "optional_data_source";

/** 住所の表記ゆれチェック用データセット設定 */
type JoinCheckDatasetConfig = {
  path: string;
  columns: {
    address: string;
  };
};

/** 住所の表記ゆれチェックパラメータ（IF005） */
export type JoinCheckParameters = {
  parameterType: "join_check";
  settings: {
    /** 候補の最大件数（"10"など） */
    max_number: string;
    /** 市区町村名（住所正規化で先頭から除去する） */
    municipality: string;
  };
  data: {
    /** 水道データ（必須・結合基準） */
    water_status: JoinCheckDatasetConfig;
    /** 住民基本台帳 */
    resident_registry?: JoinCheckDatasetConfig;
    /** 登記情報 */
    building_registry?: JoinCheckDatasetConfig;
    /** 建物種別判定用データ */
    building_type_determination?: JoinCheckDatasetConfig;
    /** ジオコーディング済みデータ */
    geocoding?: JoinCheckDatasetConfig;
    /** 空き家調査結果 */
    vacant_house?: JoinCheckDatasetConfig;
    /** 建物関連データ */
    optional_data_source?: JoinCheckDatasetConfig;
  };
};

export type JobParameters =
  | (BaseParameters &
      (
        | PreprocessParameters
        | ModelCreateParameters
        | ResultParameters
        | ExportParameters
        | JoinCheckParameters
      ))
  | DraftPreprocessParameters // 下書き状態（BaseParametersなし）
  | {
      parameterType: "unknown";
      [key: string]: unknown;
    };
