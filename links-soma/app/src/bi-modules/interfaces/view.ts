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
} from "./parameter";

/**
 * View: 保存する際の型
 */
interface ViewBase {
  id: number;
  dataSetResultId: number;
  style: "bar" | "line" | "pie" | "table" | "map";
  title: string;
  unit: "building" | "area";
  parameters: ParameterBase[];
  /**
   * yearプロパティはparameters.YearFilter と被っていそう
   * areasプロパティはparameters.AreaFilter と被っていそうかつ、更新されていなそう
   */
}

export interface MapView extends ViewBase {
  style: "map";
  parameters: (YearFilter | AreaFilter)[];
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
  )[];
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
  )[];
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
  )[];
}

/** 表 */
export interface TableView extends ViewBase {
  style: "table";
  parameters: (YearFilter | AreaFilter | FilterCondition | TableColumns)[];
}

export type View = BarView | LineView | PieView | TableView | MapView;
