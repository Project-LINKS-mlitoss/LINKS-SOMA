import { and, eq, gte, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../utils/db";
import { type BarView } from "../interfaces/view";
import { data_set_detail_areas } from "../../schema";
import { type FilterCondition } from "../interfaces/parameter";
import { type ChartProps } from "../../@types/charts";
import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
} from "../../config/column-metadata";
import { filterQueryBuilder } from "./builder/filter-query-builder";
import { conditionsToCaseQueryBuilder } from "./builder/conditions-to-case-query-builder";

type Params = {
  view: BarView;
  pagination: {
    limit: number;
    offset: number;
  };
};

/**
 * 既知の仕様1: グルーピングによる集計で、1レコード1グループにしか所属できない
 * 既知の仕様2: グルーピングによる集計で、ヒットしない場合はチャートに表示できない
 */
export const fetchAreaBarChartData = async ({
  view,
  pagination: { limit, offset },
}: Params): Promise<ChartProps> => {
  if (view.style !== "bar") {
    throw new Error(
      'このAPIは棒グラフ(style: "bar")のデータのみ対応しています',
    );
  }
  if (view.unit !== "area") {
    throw new Error(
      'このAPIは地域単位(unit: "area")のデータのみ対応しています',
    );
  }

  const { dataSetResultId } = view;

  // パラメータの型安全な抽出
  const xAxis = view.parameters.find((p) => p.key === "xAxis");
  const yAxis = view.parameters.find((p) => p.key === "yAxis");
  const yearFilter = view.parameters.find((p) => p.key === "year");
  const areaFilter = view.parameters.find((p) => p.key === "area");
  const groupConditions = view.parameters.filter((p) => p.type === "group");
  const filterConditions = view.parameters.filter(
    (p): p is FilterCondition /** startsWithが型推論しないため */ =>
      p.key.startsWith("filter_"),
  );
  const groupAggregation = view.parameters.find(
    (p) => p.type === "group_aggregation",
  );

  // 必須パラメータの検証
  if (!dataSetResultId) {
    throw new Error("dataSetResultIdは必須です");
  }
  if (!xAxis || !yAxis) {
    throw new Error("X軸とY軸の設定は必須です");
  }

  /** 項目のラベル情報 */
  const COLUMNS = {
    xAxisColumn: {
      type: "string",
      unit: AREA_DATASET_COLUMN_METADATA[xAxis.value as AREA_DATASET_COLUMN]
        .unit,
      label:
        AREA_DATASET_COLUMN_METADATA[xAxis.value as AREA_DATASET_COLUMN].label,
    },
    yAxisColumn: {
      type: "number",
      unit: AREA_DATASET_COLUMN_METADATA[yAxis.value as AREA_DATASET_COLUMN]
        .unit,
      label:
        AREA_DATASET_COLUMN_METADATA[yAxis.value as AREA_DATASET_COLUMN].label,
    },
  } as const;

  // クエリのベース作成
  let query = db
    .select({
      /** data_set_detail_areasのColumn名とそれぞれのvalueに定義された値が一致していることが前提でrawを利用 */
      [xAxis.value]: sql.raw(`${xAxis.value}`).as(xAxis.value),
      [yAxis.value]: sql.raw(`${yAxis.value}`).as(yAxis.value),
      reference_date: data_set_detail_areas.reference_date,
    })
    .from(data_set_detail_areas)
    .$dynamic();

  const queryWheres: (SQL<unknown> | undefined)[] = [
    eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
  ];

  /** 年のフィルタ */
  if (yearFilter?.value.start) {
    queryWheres.push(
      gte(
        data_set_detail_areas.reference_date,
        `${yearFilter.value.start}-01-01`,
      ),
    );
  }
  if (yearFilter?.value.end) {
    queryWheres.push(
      lte(
        data_set_detail_areas.reference_date,
        `${yearFilter.value.end}-12-31`,
      ),
    );
  }

  /** 地域のフィルタ */
  if (areaFilter?.value) {
    queryWheres.push(
      or(
        ...(areaFilter.value ?? []).map((area) =>
          eq(data_set_detail_areas.area_group, area),
        ),
      ),
    );
  }

  /** フィルタ詳細条件のフィルタ */
  if (filterConditions) {
    queryWheres.push(
      and(...filterQueryBuilder({ conditions: filterConditions })),
    );
  }

  query = query.where(and(...queryWheres));

  const baseQuery = query.as("baseQuery");

  /**
   * グループ条件がある場合の処理
   * - paginationは適用されない
   * - @todo UIでは適用できそうになってるので修正が必要そう
   */
  if (groupConditions.length > 0) {
    const GroupLabel = `group` as const;
    const caseQuery = conditionsToCaseQueryBuilder(
      xAxis.value,
      groupConditions,
    );

    const groupQuery = db
      .select({
        [xAxis.value]: baseQuery[xAxis.value],
        [yAxis.value]: baseQuery[yAxis.value],
        [GroupLabel]: caseQuery.as("caseQuery"),
      })
      .from(baseQuery)
      .as("GroupLabel");

    const result = db
      .select({
        x: groupQuery[GroupLabel],
        y: sql.raw(
          `${groupAggregation?.value || "avg"}(${yAxis.value}) as ${yAxis.value}`,
        ),

        [GroupLabel]: groupQuery[GroupLabel],
      })
      .from(groupQuery)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- @fixme 解決できないため
      // @ts-ignore
      .groupBy(groupQuery[GroupLabel])
      .having(ne(groupQuery[GroupLabel], sql.raw("''")))
      .all();

    return {
      data: result.map((item) => ({
        x: item.x as string /** @todo */,
        y: item.y as number /** @todo */,
      })),
      ...COLUMNS,
    };
  }

  const result = db
    .select()
    .from(baseQuery)
    .limit(limit)
    .offset(offset)
    .orderBy(baseQuery.reference_date)
    .all();

  return {
    data: result.map((item) => ({
      ...item,
      x: item[xAxis.value] as string /** @todo */,
      y: item[yAxis.value] as number /** @todo */,
      reference_date: item.reference_date,
    })),
    ...COLUMNS,
  };
};
