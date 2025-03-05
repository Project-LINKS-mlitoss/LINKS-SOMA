import { type z } from "zod";
import { type schema as modelCreateSchema } from "../hooks/use-form-model-create";
import { type schema as normalizationSchema } from "../hooks/use-form-normalization";
import { type schema as resultSchema } from "../hooks/use-form-data-evaluate";

type BaseParameters = {
  output_path?: string; // ファイル出力が必要な場合のみ指定
  database_path: string; // SQLite データベースファイルのパス
};

export type PreprocessParameters = { parameterType: "preprocess" } & z.infer<
  typeof normalizationSchema
>;
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
  target_unit: "building" | "area";
  data_set_results_id: number;
  reference_date: string;
};

export type JobParameters = BaseParameters &
  (
    | PreprocessParameters
    | ModelCreateParameters
    | ResultParameters
    | ExportParameters
  );
