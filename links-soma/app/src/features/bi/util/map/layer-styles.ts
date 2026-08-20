import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "@maplibre/maplibre-gl-style-spec";

export const LAYER_COLORS = {
  RED: "#C4314B",
  YELLOW: "#FFA929",
  GREEN: "#1B8C63",
  GRAY: "#999999",
  WHITE: "#ffffff",
  /** 重複ポリゴン・ポイントの境界線色 */
  OVERLAP_OUTLINE: "#9E9E9E",
  /** 変化率が負（空き家推定確率が下がった）側の色 */
  DECREASE: "#2B579A",
  /**
   * 変化率が 0 付近（横ばい）の色。増減どちらにも寄らない中間色。
   * 発散配色の定石は白だが、ベースマップの地色（明るいグレー）と同化して
   * 建物が消えて見えるため、彩度を持たせた淡いベージュにしている。
   */
  UNCHANGED: "#E8D9B5",
  /** 変化率レイヤーの輪郭。中間色の建物をベースマップから分離する */
  CHANGE_RATE_OUTLINE: "#605E5C",
} as const;

/**
 * 変化率の色グラデーションが振り切れる絶対値。
 * ±50%（確率が1.5倍・0.5倍）を上下限とし、超える値は端の色へ clamp する。
 *
 * 確率と違い変化率は上限を持たないため、データ最大値に連動させると外れ値1件で
 * 他が同色に潰れる。固定境界にして年度・データセット間で色の意味を揃える。
 * 値の根拠は fixture（千代田区ダミーデータ・2024/2025 の2年度）での実測分布
 * -34.5%〜+38.5% で、この範囲が中間色に潰れずグラデーションを使い切る。
 * 実データの変化幅がこれと大きく異なる場合は再調整が要る。
 */
export const CHANGE_RATE_BOUND = 0.5;

/**
 * 確率値に基づく色分けのMapLibreスタイル表現を生成（連続グラデーション）
 * @param predictedProbability グラデーションの境界値（medium=黄, high=赤）
 * @param propertyName 参照するプロパティ名（デフォルト: predicted_probability）
 */
export const createColorExpression = (
  predictedProbability: {
    medium: number;
    high: number;
  },
  propertyName = "predicted_probability",
): DataDrivenPropertyValueSpecification<string> => [
  "case",
  // 数値のときだけ確率に応じた連続グラデーション。境界値を stop に流用し緑→黄→赤を補間（両端 clamp）。
  // typeof 式は runtime 対応済だが型定義の union に未収録のためキャスト（MapLibre レガシーフィルタと同型）
  [
    "==",
    ["typeof", ["get", propertyName]],
    "number",
  ] as unknown as ExpressionSpecification,
  [
    "interpolate",
    ["linear"],
    ["get", propertyName],
    0,
    LAYER_COLORS.GREEN,
    predictedProbability.medium,
    LAYER_COLORS.YELLOW,
    predictedProbability.high,
    LAYER_COLORS.RED,
  ],
  // 推定確率なし（null・推定不可）は「低リスク」と誤認させないためデータなし＝グレー
  LAYER_COLORS.GRAY,
];

/**
 * 変化率に基づく色分けのMapLibreスタイル表現を生成（発散グラデーション）
 *
 * 増加を赤にするのは確率の色分け（高リスク=赤）と揃えるため。減少は反対色の青、
 * 横ばいは無彩色に近い中間色で、増減の向きを色相で読めるようにする。
 * @param propertyName 参照するプロパティ名（変化率カラム）
 */
export const createChangeRateColorExpression = (
  propertyName: string,
): DataDrivenPropertyValueSpecification<string> => [
  "case",
  // 数値のときだけ変化率に応じた発散グラデーション（青→中間→赤、両端 clamp）。
  // typeof 式は runtime 対応済だが型定義の union に未収録のためキャスト（確率側と同型）
  [
    "==",
    ["typeof", ["get", propertyName]],
    "number",
  ] as unknown as ExpressionSpecification,
  [
    "interpolate",
    ["linear"],
    ["get", propertyName],
    -CHANGE_RATE_BOUND,
    LAYER_COLORS.DECREASE,
    0,
    LAYER_COLORS.UNCHANGED,
    CHANGE_RATE_BOUND,
    LAYER_COLORS.RED,
  ],
  // 変化率なし（単一年度・初回観測・基準値0）は増減を語れないためグレー
  LAYER_COLORS.GRAY,
];

/** グラデーション色境界のドメイン比率（緑=0 / 黄=medium / 赤=high）。building 実績(0.45/0.70)由来 */
export const GRADIENT_STOP_RATIOS = { medium: 0.45, high: 0.7 } as const;

/**
 * ドメイン上限から色境界を算出する。
 * building は domainMax=1 で従来の 0.45/0.70。area はデータ最大値に連動し、
 * データ分布に対し常に同じ比率で中間色が出る（building と同じ見え方）。
 */
export const getGradientStops = (
  domainMax: number,
): { medium: number; high: number } => ({
  medium: GRADIENT_STOP_RATIOS.medium * domainMax,
  high: GRADIENT_STOP_RATIOS.high * domainMax,
});

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

// sRGB 成分の線形補間。MapLibre interpolate ["linear"] の既定色空間と一致させる
const lerpColor = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const ch = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(a.r, b.r)}${ch(a.g, b.g)}${ch(a.b, b.b)}`;
};

/**
 * 確率値を地図ポリゴンと同じ連続グラデーション色（緑→黄→赤）に変換する。
 * createColorExpression（MapLibre interpolate）と色を一致させるための JS 実装。
 * stop は 0/medium/high、両端 clamp、null はデータなし＝グレー。
 * @param predictedProbability 推定確率（null は推定不可）
 * @param threshold グラデーションの境界値（medium=黄, high=赤）
 */
export const getProbabilityColor = (
  predictedProbability: number | null,
  threshold: { medium: number; high: number },
): string => {
  if (predictedProbability === null) return LAYER_COLORS.GRAY;
  const { medium, high } = threshold;
  if (predictedProbability <= 0) return LAYER_COLORS.GREEN;
  if (predictedProbability >= high) return LAYER_COLORS.RED;
  if (predictedProbability <= medium) {
    return lerpColor(
      LAYER_COLORS.GREEN,
      LAYER_COLORS.YELLOW,
      predictedProbability / medium,
    );
  }
  return lerpColor(
    LAYER_COLORS.YELLOW,
    LAYER_COLORS.RED,
    (predictedProbability - medium) / (high - medium),
  );
};

/**
 * 地図の色分けが表す指標。確率は 0〜1 の連続量、変化率は 0 を境に増減へ分かれる量で、
 * 同じグラデーションでは向きを表現できないため配色を分ける。
 */
export type MapColorMetric = "probability" | "change-rate";

/**
 * 指標に応じた色分け式を返す。
 * @param metric 色分けが表す指標
 * @param propertyName 参照するプロパティ名
 * @param probabilityStops 確率のグラデーション境界（変化率では使わない）
 */
export const createColorExpressionForMetric = (
  metric: MapColorMetric,
  propertyName: string,
  probabilityStops: { medium: number; high: number },
): DataDrivenPropertyValueSpecification<string> =>
  metric === "change-rate"
    ? createChangeRateColorExpression(propertyName)
    : createColorExpression(probabilityStops, propertyName);

/**
 * ポリゴンの輪郭色を返す。
 * 変化率は横ばい付近が淡色になり塗りだけでは輪郭を失うため固定の濃色で縁取る。
 * 確率は全域が彩度を持つので塗りと同色にする。
 */
export const createOutlineColorForMetric = (
  metric: MapColorMetric,
  propertyName: string,
  probabilityStops: { medium: number; high: number },
): DataDrivenPropertyValueSpecification<string> =>
  metric === "change-rate"
    ? LAYER_COLORS.CHANGE_RATE_OUTLINE
    : createColorExpressionForMetric(metric, propertyName, probabilityStops);

/**
 * 変化率を地図ポリゴンと同じ発散グラデーション色（青→中間→赤）に変換する。
 * createChangeRateColorExpression（MapLibre interpolate）と色を一致させるための JS 実装。
 * 凡例の色見本に使う。両端 clamp、数値でない入力はデータなし＝グレー。
 *
 * MapLibre の GeoJSON ソースは null 値のプロパティをエンコードしないため、
 * ソース由来の properties では変化率が undefined になる。数値以外をここで弾かないと
 * 補間へ落ちて "#NaNNaNNaN" という無効な色を返す。
 * @param changeRate 年度間変化率（null / undefined / NaN は算出対象外）
 */
export const getChangeRateColor = (
  changeRate: number | null | undefined,
): string => {
  if (typeof changeRate !== "number" || !Number.isFinite(changeRate)) {
    return LAYER_COLORS.GRAY;
  }
  if (changeRate <= -CHANGE_RATE_BOUND) return LAYER_COLORS.DECREASE;
  if (changeRate >= CHANGE_RATE_BOUND) return LAYER_COLORS.RED;
  if (changeRate === 0) return LAYER_COLORS.UNCHANGED;
  if (changeRate < 0) {
    return lerpColor(
      LAYER_COLORS.UNCHANGED,
      LAYER_COLORS.DECREASE,
      -changeRate / CHANGE_RATE_BOUND,
    );
  }
  return lerpColor(
    LAYER_COLORS.UNCHANGED,
    LAYER_COLORS.RED,
    changeRate / CHANGE_RATE_BOUND,
  );
};

export const createClickedStateExpression = <T extends number | string>(
  clickedValue: T,
  normalValue: T,
): DataDrivenPropertyValueSpecification<T> => [
  "case",
  ["boolean", ["feature-state", "clicked"], false],
  clickedValue,
  normalValue,
];
