export enum JobType {
  Preprocess = "preprocess",
  ML = "ml",
  Result = "result",
  Export = "export",
}

export const TYPE_DISPLAY_MAP: Record<JobType, string> = {
  [JobType.Preprocess]: "名寄せ処理",
  [JobType.ML]: "モデル構築",
  [JobType.Result]: "空き家推定",
  [JobType.Export]: "ダウンロード準備",
};
