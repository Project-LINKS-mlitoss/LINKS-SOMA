import { and, count, eq, gte, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../../db/client";
import { type PieView } from "../../types/models/view";
import { data_set_detail_buildings } from "../../../../db/schema";
import { type FilterCondition } from "../../types/models/parameter";
import { type ChartProps } from "../../types/models/charts";
import {
  type BUILDING_DATASET_COLUMN,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../../../shared/config/column-metadata";
import { filterQueryBuilder } from "../builder/filter-query-builder";
import { conditionsToCaseQueryBuilder } from "../builder/conditions-to-case-query-builder";
import {
  extractThresholdFromParameters,
  getBuildingPredictedLabelColumn,
  THRESHOLD_COLUMN_BASES,
} from "../../util/threshold-column-utils";
import { resolveChartAggregation } from "../../util/chart-aggregation";
import { PIE_UNGROUPED_ROW_LIMIT } from "../../config/chart-limits";

type Params = {
  view: PieView;
};

export const fetchBuildingPieChartData = async ({
  view,
}: Params): Promise<ChartProps> => {
  if (view.style !== "pie") {
    throw new Error(
      'このAPIは円グラフ(style: "pie")のデータのみ対応しています',
    );
  }
  if (view.unit !== "building") {
    throw new Error(
      'このAPIは建物単位(unit: "building")のデータのみ対応しています',
    );
  }

  const { dataSetResultId } = view;

  // パラメータの型安全な抽出
  /** @note 円グラフの場合はラベルと値の組み合わせをx/y軸に設定する */
  const xAxis = view.parameters.find((p) => p.key === "label");
  const yAxis = view.parameters.find((p) => p.key === "value");

  const yearFilter = view.parameters.find((p) => p.key === "year");
  const areaFilter = view.parameters.find((p) => p.key === "area");
  const groupConditions = view.parameters.filter((p) => p.type === "group");
  const filterConditions = view.parameters.filter(
    (p): p is FilterCondition /** startsWithが型推論しないため */ =>
      p.key.startsWith("filter_"),
  );

  // 閾値パラメータの抽出
  const threshold = extractThresholdFromParameters(view.parameters);

  /**
   * 閾値に基づく値カラム名の解決
   * 閾値が設定されている場合、predicted_label を
   * 対応する閾値カラム（例: predicted_label_50）に置き換える
   */
  const resolveValueColumn = (column: string): string => {
    if (threshold === undefined) {
      return column;
    }
    if (column === THRESHOLD_COLUMN_BASES.building.predictedLabel) {
      return getBuildingPredictedLabelColumn(threshold);
    }
    return column;
  };

  // 必須パラメータの検証
  if (!dataSetResultId) {
    throw new Error("dataSetResultIdは必須です");
  }

  if (!xAxis || !yAxis) {
    throw new Error("ラベルと値の設定は必須です");
  }

  /**
   * 円グラフは区分けと集計を同じカラムで行う。
   * 区分け（CASE式）は常にラベルのカラムに対して作られるため、集計対象を別カラムにすると
   * 「区分けの軸」と「集計する量」が食い違う。UI側でも「値」はラベルに固定しているので、
   * 保存済みビューの値がラベルと異なっていてもここでラベル側に揃える。
   */
  const valueColumn = xAxis.value;

  // 閾値に基づいて値カラム名を解決
  const resolvedValueColumn = resolveValueColumn(valueColumn);

  /** 項目のラベル情報 */
  const COLUMNS = {
    xAxisColumn: {
      type: "string",
      unit: BUILDING_DATASET_COLUMN_METADATA[
        xAxis.value as BUILDING_DATASET_COLUMN
      ].unit,
      label:
        BUILDING_DATASET_COLUMN_METADATA[xAxis.value as BUILDING_DATASET_COLUMN]
          .label,
    },
    yAxisColumn: {
      type: "number",
      unit: BUILDING_DATASET_COLUMN_METADATA[
        valueColumn as BUILDING_DATASET_COLUMN
      ].unit,
      label:
        BUILDING_DATASET_COLUMN_METADATA[valueColumn as BUILDING_DATASET_COLUMN]
          .label,
    },
  } as const;

  /**
   * クエリのベース作成（全レコードを対象に集計するためselectを使用）
   *
   * ラベルと値は同一カラムなので取得するのは1カラム。閾値が設定されている場合は
   * 解決後のカラム（例: predicted_label_50）を元のカラム名の別名で取得し、
   * 以降の階層はこの別名だけを参照する。
   * data_set_detail_buildingsのColumn名とそれぞれのvalueに定義された値が一致していることが前提でrawを利用。
   */
  let query = db
    .select({
      [valueColumn]: sql.raw(`${resolvedValueColumn}`).as(valueColumn),
    })
    .from(data_set_detail_buildings)
    .$dynamic();

  const queryWheres: (SQL<unknown> | undefined)[] = [
    eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
  ];

  // allCountはselectDistinctの影響を受けないよう独立したクエリで計算
  const allCount = await db
    .select({ count: count() })
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId));

  /** 年のフィルタ */
  if (yearFilter?.value.start) {
    queryWheres.push(
      gte(
        data_set_detail_buildings.reference_date,
        `${yearFilter.value.start}-01-01`,
      ),
    );
  }
  if (yearFilter?.value.end) {
    queryWheres.push(
      lte(
        data_set_detail_buildings.reference_date,
        `${yearFilter.value.end}-12-31`,
      ),
    );
  }

  /** 地域のフィルタ */
  if (areaFilter?.value) {
    queryWheres.push(
      or(
        ...(areaFilter.value ?? []).map((area) =>
          eq(data_set_detail_buildings.area_group, area),
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
          unit: "building",
        }),
      ),
    );
  }

  query = query.where(and(...queryWheres));

  const baseQuery = query.as("baseQuery");

  if (groupConditions.length > 0) {
    /** 数値を変換 */
    const float = groupConditions.map((groupCondition) => {
      switch (groupCondition.value.referenceColumnType) {
        case "integer":
        case "integerRange":
          return groupCondition;

        case "float":
          return {
            ...groupCondition,
            value: {
              ...groupCondition.value,
              value: Number(groupCondition.value.value / 100),
            },
          };
        case "floatRange":
          return {
            ...groupCondition,
            value: {
              ...groupCondition.value,
              startValue: Number(groupCondition.value.startValue / 100),
              lastValue: Number(groupCondition.value.lastValue / 100),
            },
          };
        default: {
          return groupCondition;
        }
      }
    });

    const GroupLabel = `group` as const;
    const caseQuery = conditionsToCaseQueryBuilder(valueColumn, float);

    const groupQuery = db
      .select({
        [valueColumn]: baseQuery[valueColumn],
        [GroupLabel]: caseQuery.as("caseQuery"),
      })
      .from(baseQuery)
      .as("GroupLabel");

    /**
     * 件数集計はグループに属する行数そのものを数えるため count(*) を使う。
     * count(値カラム) にすると値カラムがNULLの行が件数から外れ、
     * 「値」に何を選んだかで構成比が変わってしまう。
     *
     * 平均・合計の集計対象にはサブクエリの別名（valueColumn）を渡す。
     * 閾値解決後の実カラム名（例: predicted_label_50）はサブクエリで別名に畳まれており、
     * この階層には存在しないため参照するとSQLエラーになる。
     *
     * 集計方法が未設定のビューでも表示側と同じ既定になるよう共通の解決関数を使う。
     */
    const aggregation = resolveChartAggregation(view.parameters, view.style);
    const aggregationQuery =
      aggregation === "count"
        ? `count(*) as ${valueColumn}`
        : `${aggregation}(${valueColumn}) as ${valueColumn}`;

    const result = db
      .select({
        x: groupQuery[GroupLabel],
        y: sql.raw(aggregationQuery),
        [GroupLabel]: groupQuery[GroupLabel],
      })
      .from(groupQuery)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- .groupBy()は(SQLiteColumn | SQL)[]のみ受け付けるが、サブクエリカラムはSQL.Aliased型（SQLWrapperを実装するがSQLではない）
      // @ts-ignore
      .groupBy(groupQuery[GroupLabel])
      .having(ne(groupQuery[GroupLabel], sql.raw("''")))
      .all();

    // totalCountもselectDistinctの影響を受けないよう独立したクエリで計算
    const totalCount = await db
      .select({ count: count() })
      .from(data_set_detail_buildings)
      .where(and(...queryWheres));

    /**
     * 扇形と凡例をラベルのグループの設定順に並べる。
     * グループ条件は上にあるものから先に判定されるため、その優先順位を図の並びでも保つ。
     * SQLのGROUP BYは並び順を保証しないので、取得後に設定順へ並べ替える。
     */
    const groupOrder = groupConditions.map(
      (condition) => condition.value.label,
    );
    const orderedResult = [...result].sort((a, b) => {
      const indexA = groupOrder.indexOf(a.x as string);
      const indexB = groupOrder.indexOf(b.x as string);
      return (
        (indexA === -1 ? groupOrder.length : indexA) -
        (indexB === -1 ? groupOrder.length : indexB)
      );
    });

    return {
      data: orderedResult.map((item) => ({
        x: item.x as string /* sql.rawの戻り値がunknownのため明示的にキャスト */,
        y: item.y as number /* sql.rawの戻り値がunknownのため明示的にキャスト */,
      })),
      totalCount: totalCount[0].count,
      allCount: allCount[0].count,
      ...COLUMNS,
    };
  }

  /**
   * ラベルのグループがない場合は1行が1つの扇形になる。
   * 数万件の建物をそのまま扇形にすると描画が固まるため件数を打ち切る。
   * この状態は設定が未完了なだけで図として成立しておらず、ビュー側で設定を促している。
   */
  const result = db
    .select({
      x: baseQuery[valueColumn],
      y: baseQuery[valueColumn],
    })
    .from(baseQuery)
    .limit(PIE_UNGROUPED_ROW_LIMIT)
    .all();

  // totalCountもselectDistinctの影響を受けないよう独立したクエリで計算
  const totalCount = await db
    .select({ count: count() })
    .from(data_set_detail_buildings)
    .where(and(...queryWheres));

  return {
    data: result.map((item) => ({
      x: item.x as string /* sql.rawの戻り値がunknownのため明示的にキャスト */,
      y: item.y as number /* sql.rawの戻り値がunknownのため明示的にキャスト */,
    })),
    totalCount: totalCount[0].count,
    allCount: allCount[0].count,
    ...COLUMNS,
  };
};
