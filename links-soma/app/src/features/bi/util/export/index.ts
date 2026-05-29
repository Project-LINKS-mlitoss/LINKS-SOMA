import {
  type LineView,
  type BarView,
  type PieView,
} from "../../types/models/view";
import { generateCsv } from "./csv-generator";
import { generateCsvFileName } from "./filename-generator";
import {
  transformLineChartData,
  transformBarChartData,
  transformPieChartData,
  type ExportChartProps,
} from "./chart-data-transformer";

/**
 * チャートデータからCSVをエクスポートするメイン関数
 */

export interface ExportCsvResult {
  csvContent: string;
  fileName: string;
}

/**
 * ラインチャートのCSVエクスポート
 */
const exportLineChartCsv = (
  view: LineView,
  chartProps: ExportChartProps,
): ExportCsvResult => {
  const { columns, rows } = transformLineChartData(view, chartProps);
  const csvContent = generateCsv(columns, rows);
  const fileName = generateCsvFileName(view, chartProps);

  return { csvContent, fileName };
};

/**
 * バーチャートのCSVエクスポート
 */
const exportBarChartCsv = (
  view: BarView,
  chartProps: ExportChartProps,
): ExportCsvResult => {
  const { columns, rows } = transformBarChartData(view, chartProps);
  const csvContent = generateCsv(columns, rows);
  const fileName = generateCsvFileName(view, chartProps);

  return { csvContent, fileName };
};

/**
 * パイチャートのCSVエクスポート
 */
const exportPieChartCsv = (
  view: PieView,
  chartProps: ExportChartProps,
): ExportCsvResult => {
  const { columns, rows } = transformPieChartData(view, chartProps);
  const csvContent = generateCsv(columns, rows);
  const fileName = generateCsvFileName(view, chartProps);

  return { csvContent, fileName };
};

/**
 * チャートタイプに応じた汎用エクスポート関数
 */
export const exportChartCsv = (
  view: LineView | BarView | PieView,
  chartProps: ExportChartProps,
): ExportCsvResult => {
  if (view.style === "line") {
    return exportLineChartCsv(view as LineView, chartProps);
  } else if (view.style === "bar") {
    return exportBarChartCsv(view as BarView, chartProps);
  } else if (view.style === "pie") {
    return exportPieChartCsv(view as PieView, chartProps);
  } else {
    throw new Error(
      `Unsupported chart type: ${(view as { style: string }).style}`,
    );
  }
};
