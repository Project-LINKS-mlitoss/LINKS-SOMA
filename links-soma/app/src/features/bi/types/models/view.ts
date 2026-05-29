import {
  type OrderByQuery,
  type PaginationQuery,
} from "../../../../shared/types/query";
import { type VIEW_STYLES } from "../../../../shared/config/view-styles";
import {
  type SelectDataSetDetailBuilding,
  type SelectDataSetDetailArea,
} from "../../../../db/schema";
import {
  type AreaFilter,
  type FilterCondition,
  type GroupCondition,
  type PieLabel,
  type PieValue,
  type TableColumns,
  type YearFilter,
  type XAxis,
  type YAxis,
  type ParameterBase,
  type GroupAggregation,
  type YAxisMinMax,
  type Threshold,
} from "./parameter";

/**
 * View: 保存する際の型
 */
interface ViewBase {
  id: number;
  dataSetResultId: number;
  style: (typeof VIEW_STYLES)[number];
  title: string;
  unit: "building" | "area";
  parameters: ParameterBase[];
  /**
   * yearプロパティはparameters.YearFilter と被っていそう
   * areasプロパティはparameters.AreaFilter と被っていそうかつ、更新されていなそう
   */
}

/** 棒グラフ */
export interface BarView extends ViewBase {
  style: "bar";
  parameters: (
    | YearFilter
    | AreaFilter
    | FilterCondition
    | GroupCondition
    | GroupAggregation
    | XAxis
    | YAxis
    | YAxisMinMax
    | Threshold
  )[];

  pagination: PaginationQuery;
  orderBy: OrderByQuery<keyof SelectDataSetDetailArea> | null;
}

/** 折れ線グラフ */
export interface LineView extends ViewBase {
  style: "line";
  parameters: (
    | YearFilter
    | AreaFilter
    | FilterCondition
    | GroupCondition
    | GroupAggregation
    | XAxis
    | YAxis
    | YAxisMinMax
    | Threshold
  )[];

  orderBy: OrderByQuery<keyof SelectDataSetDetailBuilding> | null;
}

/** 円グラフ */
export interface PieView extends ViewBase {
  style: "pie";
  parameters: (
    | YearFilter
    | AreaFilter
    | FilterCondition
    | GroupCondition
    | GroupAggregation
    | PieLabel
    | PieValue
    | Threshold
  )[];
}

/** 表 */
export interface TableView extends ViewBase {
  style: "table";
  parameters: (
    | YearFilter
    | AreaFilter
    | FilterCondition
    | TableColumns
    | Threshold
  )[];
}

/** 地図 + テーブル */
export interface MapWithTableView extends ViewBase {
  style: "map-with-table";
  parameters: (
    | YearFilter
    | AreaFilter
    | FilterCondition
    | TableColumns
    | Threshold
  )[];
}

export type View = BarView | LineView | PieView | TableView | MapWithTableView;
