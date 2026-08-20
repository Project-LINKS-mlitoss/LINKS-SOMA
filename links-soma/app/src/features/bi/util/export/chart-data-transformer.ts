import {
  type LineView,
  type BarView,
  type PieView,
} from "../../types/models/view";
import { resolveChartAggregation } from "../chart-aggregation";
import { type CsvColumn, type CsvRow } from "./csv-generator";

/**
 * チャートデータをCSV用に変換するユーティリティ
 */

export interface ChartData {
  x: string | number;
  y: number;
  reference_date?: string;
}

export interface ExportChartProps {
  data: ChartData[];
  xAxisColumn: { label: string; unit?: string };
  yAxisColumn: { label: string; unit?: string };
  allCount: number;
  totalCount: number;
}

/**
 * ラインチャート用のCSV変換
 */
export const transformLineChartData = (
  view: LineView,
  chartProps: ExportChartProps,
): { columns: CsvColumn[]; rows: CsvRow[] } => {
  const columns: CsvColumn[] = [
    {
      key: "x",
      label: chartProps.xAxisColumn.label,
      unit: chartProps.xAxisColumn.unit,
    },
    {
      key: "y",
      label: chartProps.yAxisColumn.label,
      unit: chartProps.yAxisColumn.unit,
    },
  ];

  // reference_dateがある場合は列に追加
  if (chartProps.data.length > 0 && chartProps.data[0].reference_date) {
    columns.push({
      key: "reference_date",
      label: "推定日",
    });
  }

  const rows: CsvRow[] = chartProps.data.map((item) => {
    const row: CsvRow = {
      x: item.x,
      y: item.y,
    };
    if (item.reference_date) {
      row.reference_date = item.reference_date;
    }
    return row;
  });

  return { columns, rows };
};

/**
 * バーチャート用のCSV変換
 */
export const transformBarChartData = (
  view: BarView,
  chartProps: ExportChartProps,
): { columns: CsvColumn[]; rows: CsvRow[] } => {
  const columns: CsvColumn[] = [
    {
      key: "x",
      label: chartProps.xAxisColumn.label,
      unit: chartProps.xAxisColumn.unit,
    },
    {
      key: "y",
      label: chartProps.yAxisColumn.label,
      unit: chartProps.yAxisColumn.unit,
    },
  ];

  // reference_dateがある場合は列に追加
  if (chartProps.data.length > 0 && chartProps.data[0].reference_date) {
    columns.push({
      key: "reference_date",
      label: "推定日",
    });
  }

  const rows: CsvRow[] = chartProps.data.map((item) => {
    const row: CsvRow = {
      x: item.x,
      y: item.y,
    };
    if (item.reference_date) {
      row.reference_date = item.reference_date;
    }
    return row;
  });

  return { columns, rows };
};

/**
 * パイチャート用のCSV変換
 */
export const transformPieChartData = (
  view: PieView,
  chartProps: ExportChartProps,
): { columns: CsvColumn[]; rows: CsvRow[] } => {
  /** 未設定のビューでも取得側と同じ既定になるよう共通の解決関数を使う */
  const groupAggregation = resolveChartAggregation(view.parameters, view.style);

  const columns: CsvColumn[] = [
    {
      key: "x",
      label: chartProps.xAxisColumn.label,
      unit: chartProps.xAxisColumn.unit,
    },
    {
      key: "y",
      label: chartProps.yAxisColumn.label,
      unit: groupAggregation === "count" ? "件" : chartProps.yAxisColumn.unit,
    },
  ];

  // パイチャートでは構成比も追加
  const totalValue = chartProps.data.reduce((sum, item) => sum + item.y, 0);

  if (totalValue > 0) {
    columns.push({
      key: "percentage",
      label: "構成比",
      unit: "%",
    });
  }

  const rows: CsvRow[] = chartProps.data.map((item) => {
    const row: CsvRow = {
      x: item.x,
      y: item.y,
    };

    if (totalValue > 0) {
      row.percentage = Math.round((item.y / totalValue) * 1000) / 10; // 小数点第1位まで
    }

    return row;
  });

  return { columns, rows };
};
