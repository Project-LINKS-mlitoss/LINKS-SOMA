/**
 * BIツール関連で利用する方をまとめたファイル
 */

import {
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../../../../shared/config/column-metadata";

import { type Parameter } from "./parameter";

/**
 * チャートのカラムが受け付けられる型
 * JavaScriptではdateとstring, floatとintegerを区別できないため、明示する必要がある
 */
export type { ChartColumnType } from "../../../../shared/types/chart-column-type";

export interface ChartColumn {
  type: "string" | "number";
  unit?: string;
  label?: string;
}

export interface ChartData {
  x: string | number;
  y: number;
}

/**
 * チャートが共通で受け付けるBase型
 */
export interface ChartProps {
  data: ChartData[];
  xAxisColumn: ChartColumn;
  yAxisColumn: ChartColumn;
  totalCount: number;
  allCount: number;
}

/**
 * 表形式が受け付けるPropsの型
 */
export interface TableProps {
  columns: {
    key: string;
    label: string;
    unit?: string;
  }[];
  data: Record<string, string | number | null>[];
  totalCount: number;
  allCount: number;
}

export type ChartDynamicColumnInput = "select" | "input" | "dropdown";

export type TileViewFieldOption = {
  key: Parameter["key"];
  label: string;
  multiple?: boolean;
  grouping: boolean;
  option: (
    | {
        unit: "building";
        value: BUILDING_DATASET_COLUMN;
      }
    | {
        unit: "area";
        value: AREA_DATASET_COLUMN;
      }
  )[];
} & (
  | {
      type: "select";
    }
  | {
      type: "dropdown";
      multiple: boolean;
    }
  | {
      type: "dialog";
      multiple: boolean;
    }
);
