/**
 * モデル構築（IF002）に渡す設定の定数
 *
 * 説明変数は FEATURE_COLS 40個をデフォルト選択し、ユーザーはUIで追加・削除が可能。
 * ハイパーパラメータはUIを持たず固定値。
 */

/** フォーム初期値としてデフォルト選択されるカラム（FEATURE_COLS 40個準拠） */
export const DEFAULT_EXPLANATORY_COLUMNS = [
  // 水道系
  "閉栓フラグ",
  "平均検針水量",
  "年間最大検針水量",
  "年間合計検針水量",
  "直近４ヶ月の使用量増減率",
  "検針水量（推定月の11・12ヶ月前）",
  "検針水量（推定月の9・10ヶ月前）",
  "検針水量（推定月の7・8ヶ月前）",
  "検針水量（推定月の5・6ヶ月前）",
  "検針水量（推定月の3・4ヶ月前）",
  "検針水量（推定月の1・2ヶ月前）",
  // 水道時系列
  "使用量データあり",
  "ゼロ使用期数",
  "最小水道使用量",
  "閉栓後年数",
  "使用量データなし",
  "前半平均使用水量",
  "後半平均使用水量",
  "半期変化率",
  "直近使用水量",
  // 住基系
  "住民データ有無フラグ",
  "世帯人数",
  "最大年齢",
  "最大年齢欠損",
  "65歳以上人数",
  "15歳未満人数",
  "住定期間",
  "死亡人数",
  "転入数",
  "転出・転居数",
  "一人当たり検針水量",
  // 住基イベント系
  "消除イベントあり",
  "転出イベント数",
  "最終異動後経過年数",
  "最終異動経過年数欠損",
  "独居高齢者",
  "死亡後入居者なし",
  "世帯縮小率",
  // 交差・ルール系
  "複合ルールスコア",
] as const;

/** UI上で選択解除不可のカラムはなし（ユーザーが自由に選択可能） */
export const LOCKED_EXPLANATORY_COLUMNS: readonly string[] = [];

/**
 * モデル構築（IF002）へ固定で渡すハイパーパラメータ（`settings.advanced`）
 *
 * ハイパーパラメータチューニングは行わない方針のため、画面にこの値を変更するUIはなく、
 * すべてのモデルがこの1組で構築される（issue #1999）。
 *
 * `settings.advanced` を空で渡してもIF002は動くが、その場合はPython側の既定値が効く。
 * `threshold` だけはPython側の既定（0.65）と値が異なり、省略すると構築されるモデルが変わる。
 * 省略せずここから渡すことでモデルの挙動を固定する。
 *
 * 各値がPython側でどう扱われるか:
 * - `threshold`: E021では再現率目標（recall_target）として使われ、モデルに保存する推奨閾値を
 *   決める（`ml/async_tasks/IF002.py`）。この14項目で唯一モデルの出力に効く
 * - `test_size` / `lambda_l1` / `lambda_l2` / `num_leaves` / `feature_fraction` /
 *   `bagging_fraction` / `bagging_freq` / `min_data_in_leaf`: E021が読むが、ここの値は
 *   E021側の既定と同じため上書きが起きない（`ml/src/E002_Classification/E021.py`）
 * - `n_splits` / `undersample` / `undersample_ratio` / `hyperparameter_flag` / `n_trials`:
 *   E021は引数で受け取りログに出すだけで、学習には使わない
 */
export const FIXED_MODEL_ADVANCED = {
  test_size: 0.3,
  n_splits: 3,
  undersample: false,
  undersample_ratio: 3.0,
  threshold: 0.3,
  hyperparameter_flag: false,
  n_trials: 100,
  lambda_l1: 0,
  lambda_l2: 0,
  num_leaves: 31,
  feature_fraction: 1.0,
  bagging_fraction: 1.0,
  bagging_freq: 0,
  min_data_in_leaf: 20,
};

/**
 * 説明変数の候補から除外するカラム（名寄せ済みデータに含まれるが説明変数ではない）
 *
 * 空き家調査結果を結合したときだけ生成される5列で、いずれも教師ラベル
 * `is_vacant` の値を含意する。説明変数に選べるとモデルが答えを見て学習する。
 *
 * - `is_vacant`: 教師ラベルそのもの（`ml/src/E002_Classification/E021.py` の `LABEL_COL`）
 * - `vacant_type` / `vacant_source` / `vacant_year`: 調査結果とマッチした行にのみ値が入り、
 *   非マッチは空文字（`ml/src/preprocessing/record_linkage/labels.py`）。値あり ⇒ is_vacant=1
 * - `address_precision_flag`: is_vacant=1 の行だけ判定し他は一律 0（同 labels.py）。1 ⇒ is_vacant=1
 *
 * 分析画面では5列とも表示する。表示は「分かりにくい列を隠す」問題、
 * ここは「ラベルが漏れる」問題で、判断の軸が別（issue #1794）。
 */
export const HIDDEN_EXPLANATORY_COLUMNS: readonly string[] = [
  "is_vacant",
  "vacant_type",
  "vacant_source",
  "vacant_year",
  "address_precision_flag",
];
