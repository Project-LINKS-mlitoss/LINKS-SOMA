/**
 * BIツール関連で利用する方をまとめたファイル
 */

import {
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../config/column-metadata";

import { type Parameter } from "../bi-modules/interfaces/parameter";
import { type GroupConditionValue } from "../bi-modules/interfaces/group-operation";

/**
 * チャートのカラムが受け付けられる型
 * JavaScriptではdateとstring, floatとintegerを区別できないため、明示する必要がある
 */
export type ChartColumnType = GroupConditionValue["referenceColumnType"];

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
}

export type ChartDynamicColumnInput = "select" | "input" | "dropdown";

export type TileViewStyle = "pie" | "bar" | "line" | "table" | "map";

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
