/** @see https://www.notion.so/eukarya/Python-40f49a4c1a3b498486dd0e13aaad5a4a#1fe774cf19d9404182763c8e3f00dc69 */
type PreprocessTaskResult = {
  taskResultType: "preprocess";

  joining_rate: string;
  input_source?: string[];
};

type ModelCreateTaskResult = {
  taskResultType: "model_create";

  accuracy: string; // 正解率
  f1Score: string; // f値
  specificity: string; // 特異度
  precision: string; // 適合率
  recall: string; // 再現率
  important_columns: { column: string; value: string }[];
};

export type JobTaskResult = PreprocessTaskResult | ModelCreateTaskResult;
