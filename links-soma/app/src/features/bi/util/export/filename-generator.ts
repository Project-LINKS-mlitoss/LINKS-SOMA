import {
  type LineView,
  type BarView,
  type PieView,
} from "../../types/models/view";

/**
 * ファイル名生成のユーティリティ
 */

type ChartView = LineView | BarView | PieView;

/**
 * 安全なファイル名に変換（無効な文字を除去）
 */
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "_") // Windows無効文字を置換
    .replace(/\s+/g, "_") // スペースをアンダースコアに
    .replace(/_{2,}/g, "_") // 連続するアンダースコアを1つに
    .replace(/^_|_$/g, ""); // 先頭末尾のアンダースコア除去
};

/**
 * 日付文字列をファイル名用に変換
 */
const formatDateForFileName = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  } catch {
    return dateStr.replace(/[-T:]/g, "_");
  }
};

/**
 * 集計方法の日本語表記を取得
 */
const getAggregationLabel = (aggregation: string): string => {
  const labels: Record<string, string> = {
    avg: "平均値",
    count: "件数",
    sum: "合計値",
    max: "最大値",
    min: "最小値",
  };
  return labels[aggregation] || aggregation;
};

/**
 * ビューからCSVファイル名を生成
 */
export const generateCsvFileName = (
  view: ChartView,
  chartData: {
    xAxisColumn: { label: string };
    yAxisColumn: { label: string };
    data: Array<{ reference_date?: string }>;
  },
): string => {
  // ビュータイトル（メイン部分）
  const title = view.title || `${chartData.yAxisColumn.label}`;

  // X軸の情報
  const xAxisInfo = `${chartData.xAxisColumn.label}別`;

  // 日付情報（データから取得）
  let dateInfo = "";
  if (chartData.data.length > 0 && chartData.data[0].reference_date) {
    const referenceDate = chartData.data[0].reference_date;
    dateInfo = formatDateForFileName(referenceDate);
  }

  // 集計方法
  const groupAggregation = view.parameters.find(
    (p) => p.key === "group_aggregation" && p.type === "group_aggregation",
  )?.value;
  const aggregationInfo = groupAggregation
    ? getAggregationLabel(groupAggregation)
    : "";

  // ファイル名を構築
  const parts = [title, xAxisInfo, dateInfo, aggregationInfo].filter(Boolean);
  const fileName = parts.join("_");

  return `${sanitizeFileName(fileName)}.csv`;
};
