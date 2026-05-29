import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../../../db/client";
import { type BarView } from "../../types/models/view";
import { data_set_detail_areas } from "../../../../db/schema";
import { type FilterCondition } from "../../types/models/parameter";
import { type ChartProps } from "../../types/models/charts";
import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
} from "../../../../shared/config/column-metadata";
import { filterQueryBuilder } from "../builder/filter-query-builder";
import { conditionsToCaseQueryBuilder } from "../builder/conditions-to-case-query-builder";
import {
  extractThresholdFromParameters,
  getAreaVacantHouseCountColumn,
  getAreaPredictedProbabilityColumn,
  THRESHOLD_COLUMN_BASES,
} from "../../util/threshold-column-utils";

type Params = {
  view: BarView;
};

/**
 * 棒グラフ（地域単位）のデータ取得API
 *
 * ## 集計仕様
 * - 集計単位: (area_group, reference_date) の組み合わせ
 * - 同じ地域名でも基準日が異なれば別々の棒として表示
 * - Y軸の値は集計関数（デフォルト: AVG）で計算
 *
 * ## データ構造の背景
 * - 1つの地域名（area_group）に複数の区画（key_code）が存在する
 * - 例: 「羽根町字中田」に9つの区画がある場合、9区画の平均値を表示
 *
 * ## 件数表示の意味
 * - totalCount: (地域名, 基準日) の組み合わせ数 = 棒の本数
 * - allCount: 元データの全レコード数（集計前）
 *
 * ## 既知の仕様（グループ条件使用時）
 * - グルーピングによる集計で、1レコード1グループにしか所属できない
 * - グルーピングによる集計で、ヒットしない場合はチャートに表示できない
 */
export const fetchAreaBarChartData = async ({
  view,
}: Params): Promise<ChartProps> => {
  const { pagination, orderBy } = view;
  if (!pagination) {
    throw new Error("paginationは必須です");
  }
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

  const { limit, offset } = pagination;
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

  // 閾値パラメータの抽出
  const threshold = extractThresholdFromParameters(view.parameters);

  /**
   * 閾値に基づくY軸カラム名の解決
   * 閾値が設定されている場合、vacant_house_count/predicted_probability を
   * 対応する閾値カラム（例: vacant_house_count_50）に置き換える
   */
  const resolveYAxisColumn = (column: string): string => {
    if (threshold === undefined) {
      return column;
    }
    if (column === THRESHOLD_COLUMN_BASES.area.vacantHouseCount) {
      return getAreaVacantHouseCountColumn(threshold);
    }
    if (column === THRESHOLD_COLUMN_BASES.area.predictedProbability) {
      return getAreaPredictedProbabilityColumn(threshold);
    }
    return column;
  };

  // 必須パラメータの検証
  if (!dataSetResultId) {
    throw new Error("dataSetResultIdは必須です");
  }
  if (!xAxis || !yAxis) {
    throw new Error("X軸とY軸の設定は必須です");
  }

  // 閾値に基づいてY軸カラム名を解決
  const resolvedYAxisColumn = resolveYAxisColumn(yAxis.value);

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

  if (!orderBy || !orderBy.column) {
    throw new Error("orderByは必須です");
  }

  // クエリのベース作成
  let query = db
    .selectDistinct({
      /** data_set_detail_areasのColumn名とそれぞれのvalueに定義された値が一致していることが前提でrawを利用 */
      [xAxis.value]: sql.raw(`${xAxis.value}`).as(xAxis.value),
      // 閾値が設定されている場合は解決されたカラム名を使用
      [yAxis.value]: sql.raw(`${resolvedYAxisColumn}`).as(yAxis.value),

      /** OrderByで利用するための取得 */
      reference_date: data_set_detail_areas.reference_date,
      [orderBy.column]: data_set_detail_areas[orderBy.column],
    })
    .from(data_set_detail_areas)
    .$dynamic();

  const queryWheres: (SQL<unknown> | undefined)[] = [
    eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
  ];

  // allCountはselectDistinctの影響を受けないよう独立したクエリで計算
  const allCount = await db
    .select({ count: count() })
    .from(data_set_detail_areas)
    .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultId))
    .then((res) => res[0].count);

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
      and(
        ...filterQueryBuilder({
          conditions: filterConditions,
          threshold,
          unit: "area",
        }),
      ),
    );
  }

  query = query.where(and(...queryWheres));

  const baseQuery = query.as("baseQuery");

  /**
   * グループ条件がある場合の処理
   * - paginationは適用されない
   * - UIではページネーション操作が可能に見えるが、API側では未適用
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
        // 閾値が設定されている場合は解決されたカラム名を使用
        y: sql.raw(
          `${groupAggregation?.value || "avg"}(${resolvedYAxisColumn}) as ${yAxis.value}`,
        ),

        [GroupLabel]: groupQuery[GroupLabel],
      })
      .from(groupQuery)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- .groupBy()は(SQLiteColumn | SQL)[]のみ受け付けるが、サブクエリカラムはSQL.Aliased型（SQLWrapperを実装するがSQLではない）
      // @ts-ignore
      .groupBy(groupQuery[GroupLabel])
      .having(ne(groupQuery[GroupLabel], sql.raw("''")))
      .all();

    /* グループ条件時はページネーション未適用のため、totalCountは全件 */
    const totalCount = await db.select({ count: count() }).from(baseQuery);

    return {
      data: result.map((item) => ({
        x: item.x as string /* sql.rawの戻り値がunknownのため明示的にキャスト */,
        y: item.y as number /* sql.rawの戻り値がunknownのため明示的にキャスト */,
      })),
      totalCount: totalCount[0].count,
      allCount,
      ...COLUMNS,
    };
  }

  /**
   * グループ条件なしの場合: GROUP BY area_group, reference_date で集計
   * - 地域名×基準日単位で集計し、Y軸の値は平均値を表示
   * - 同じ地域でも基準日が異なれば別々の棒として表示
   */
  const aggregationFunc = groupAggregation?.value || "avg";

  const groupByQuery = db
    .select({
      x: data_set_detail_areas.area_group,
      // 閾値が設定されている場合は解決されたカラム名を使用
      y: sql.raw(`${aggregationFunc}(${resolvedYAxisColumn})`).as("y"),
      reference_date: data_set_detail_areas.reference_date,
    })
    .from(data_set_detail_areas)
    .where(and(...queryWheres))
    .groupBy(
      data_set_detail_areas.area_group,
      data_set_detail_areas.reference_date,
    )
    .as("groupByQuery");

  const orderByConditions = (() => {
    if (!orderBy) {
      return asc(groupByQuery.x);
    }

    if (orderBy.column === "area_group") {
      return orderBy.direction === "ascending"
        ? asc(groupByQuery.x)
        : desc(groupByQuery.x);
    }

    return asc(groupByQuery.x);
  })();

  const result = db
    .select()
    .from(groupByQuery)
    .orderBy(orderByConditions)
    .limit(limit)
    .offset(offset)
    .all();

  const totalCount = await db.select({ count: count() }).from(groupByQuery);

  return {
    data: result.map((item) => ({
      x: item.x as string,
      y: item.y as number,
      reference_date: item.reference_date,
    })),
    allCount,
    totalCount: totalCount[0].count,
    ...COLUMNS,
  };
};
