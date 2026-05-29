import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  lte,
  min,
  or,
  avg,
  sql,
  sum,
} from "drizzle-orm";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  isBuildingColumn,
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { columnsToSelectField } from "../../../shared/utils/columns-to-select-field";
import {
  type TableProps,
  type MapWithTableView,
  type TableView,
  type YearFilter,
  type FilterCondition,
  type AreaFilter,
} from "../../bi/types";
import {
  AREA_DATASET_COLUMN_METADATA,
  BUILDING_DATASET_COLUMN_METADATA,
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../../../shared/config/column-metadata";

import { formatTableValue } from "../util/format-table-value";
import { getColumnMetadata } from "../../../shared/utils/get-column-metadata";
import {
  type OrderByQuery,
  type PaginationQuery,
} from "../../../shared/types/query";
import {
  optimizedTableQuery,
  benchmarkedQuery,
  conditionalErrorHandling,
} from "../../../shared/utils/performance-query-helpers";
import { filterQueryBuilder } from "../../bi/services";
import {
  extractThresholdFromParameters,
  getBuildingPredictedLabelColumn,
  getAreaVacantHouseCountColumn,
  getAreaPredictedProbabilityColumn,
  THRESHOLD_COLUMN_BASES,
  type ThresholdValue,
} from "../../bi/util/threshold-column-utils";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { expandOptionalDataSource } from "../util/expand-optional-data-source";

interface BaseProps {
  view: TableView;
  pagination: PaginationQuery;
}

interface UnitBuildingProps extends BaseProps {
  unit: "building";
  columns: BUILDING_DATASET_COLUMN[];
}
interface UnitAreaProps extends BaseProps {
  unit: "area";
  columns: AREA_DATASET_COLUMN[];
}

export type FilterDataSetForTableArgs = UnitBuildingProps | UnitAreaProps;

type Params = {
  view: TableView | MapWithTableView;
  pagination: PaginationQuery;
  orderBy?: OrderByQuery<
    keyof SelectDataSetDetailBuilding | keyof SelectDataSetDetailArea
  > | null;
  selectedDate?: string;
};

export const filterDataSetForTable = (async (
  _: unknown,
  { view, pagination: { limit, offset }, orderBy, selectedDate }: Params,
): Promise<TableProps> => {
  return conditionalErrorHandling(
    async () => {
      const { dataSetResultId, parameters, unit } = view;
      const yearFilter = parameters.find((p) => p.key === "year");
      const areaFilter = parameters.find((p) => p.key === "area");
      const filterConditions = parameters.filter((p): p is FilterCondition =>
        p.key.startsWith("filter_"),
      );
      const columns =
        parameters.find((p) => p.key === "columns")?.value.split(",") ?? [];

      // 閾値パラメータの抽出
      const threshold = extractThresholdFromParameters(parameters);

      /**
       * 閾値に基づくカラム名の解決
       * 閾値が設定されている場合、predicted_label/vacant_house_count/predicted_probability を
       * 対応する閾値カラムに置き換える
       */
      const resolveColumnForBuilding = (column: string): string => {
        if (threshold === undefined) return column;
        if (column === THRESHOLD_COLUMN_BASES.building.predictedLabel) {
          return getBuildingPredictedLabelColumn(threshold);
        }
        return column;
      };

      const resolveColumnForArea = (column: string): string => {
        if (threshold === undefined) return column;
        if (column === THRESHOLD_COLUMN_BASES.area.vacantHouseCount) {
          return getAreaVacantHouseCountColumn(threshold);
        }
        if (column === THRESHOLD_COLUMN_BASES.area.predictedProbability) {
          return getAreaPredictedProbabilityColumn(threshold);
        }
        return column;
      };

      if (unit === "building") {
        // 建物用のカラムマッピングを作成（閾値設定時のみ）
        const buildingColumnMapping: Record<string, string> = {};
        if (threshold !== undefined) {
          for (const col of columns) {
            const resolved = resolveColumnForBuilding(col);
            if (resolved !== col) {
              buildingColumnMapping[col] = resolved;
            }
          }
        }

        const whereConditons = and(
          eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
          selectedDate
            ? eq(data_set_detail_buildings.reference_date, selectedDate)
            : undefined,
          yearFilter?.value.start
            ? gte(
                data_set_detail_buildings.reference_date,
                `${yearFilter.value.start}-01-01`,
              )
            : undefined,
          yearFilter?.value.end
            ? lte(
                data_set_detail_buildings.reference_date,
                `${yearFilter.value.end}-12-31`,
              )
            : undefined,
          ...filterQueryBuilder({
            conditions: filterConditions ?? [],
            threshold,
            unit: "building",
          }),
          or(
            // 地域区分文字列のリストからeq条件を作成
            ...(areaFilter?.value ?? []).map((area) =>
              eq(data_set_detail_buildings.area_group, area),
            ),
          ),
        );

        const orderByConditions = (() => {
          if (!orderBy) {
            return asc(data_set_detail_buildings.area_group);
          }

          if (isBuildingColumn(orderBy.column)) {
            return orderBy.direction === "ascending"
              ? asc(data_set_detail_buildings[orderBy.column])
              : desc(data_set_detail_buildings[orderBy.column]);
          }

          return asc(data_set_detail_buildings.area_group);
        })();

        // 並列クエリ実行による最適化
        const {
          data: all,
          filteredCount,
          totalCount,
        } = await optimizedTableQuery.getDataWithCounts({
          dataQuery: async () =>
            benchmarkedQuery(`filterBuildings_data_${dataSetResultId}`, () =>
              db
                .select({
                  ...columnsToSelectField({
                    type: "building",
                    columns: columns as BUILDING_DATASET_COLUMN[],
                    columnMapping:
                      Object.keys(buildingColumnMapping).length > 0
                        ? buildingColumnMapping
                        : undefined,
                  }),
                  id: data_set_detail_buildings.id,
                  // グレーアウト判定用（地図表示に必要なジオメトリ情報）
                  _bldg_geometry: data_set_detail_buildings.bldg_geometry,
                  _lat_geocoding: data_set_detail_buildings.lat_geocoding,
                  _lon_geocoding: data_set_detail_buildings.lon_geocoding,
                  optional_data_source:
                    data_set_detail_buildings.optional_data_source,
                })
                .from(data_set_detail_buildings)
                .where(whereConditons)
                .limit(limit)
                .offset(offset)
                .orderBy(orderByConditions),
            ),
          countQueries: {
            filtered: async () =>
              benchmarkedQuery(`filterBuildings_count_${dataSetResultId}`, () =>
                db
                  .select({ count: count() })
                  .from(data_set_detail_buildings)
                  .where(whereConditons),
              ),
            total: async () =>
              benchmarkedQuery(`filterBuildings_total_${dataSetResultId}`, () =>
                db
                  .select({ count: count() })
                  .from(data_set_detail_buildings)
                  .where(
                    and(
                      eq(
                        data_set_detail_buildings.data_set_result_id,
                        dataSetResultId,
                      ),
                    ),
                  ),
              ),
          },
          context: { operation: "filterBuildingsTable", table: "buildings" },
        });

        const returnTotalCount = filteredCount;
        const returnAllCount = totalCount;

        // optional_data_sourceのJSON配列を個別カラムに展開
        const expanded = expandOptionalDataSource(
          all as Record<string, unknown>[],
        );

        return {
          columns: [
            ...columns.map((column) => {
              const columnMetadata =
                BUILDING_DATASET_COLUMN_METADATA[
                  column as BUILDING_DATASET_COLUMN
                ];
              return {
                key: column,
                label: columnMetadata.label,
                unit: columnMetadata.unit,
              };
            }),
            ...expanded.columns,
          ],
          data: expanded.data.map((row) => {
            const rowArray = Object.entries(row);
            const formattedRow = rowArray.reduce((acc, [key, value]) => {
              const metadata = getColumnMetadata({
                key,
                unit,
              });
              return {
                ...acc,
                [key]: formatTableValue(
                  value as string | number | null,
                  metadata,
                ),
              };
            }, {});

            return formattedRow;
          }),
          totalCount: returnTotalCount,
          allCount: returnAllCount,
        };
      }

      if (unit === "area") {
        // 地域用のカラムマッピングを作成（閾値設定時のみ）
        const areaColumnMapping: Record<string, string> = {};
        if (threshold !== undefined) {
          for (const col of columns) {
            const resolved = resolveColumnForArea(col);
            if (resolved !== col) {
              areaColumnMapping[col] = resolved;
            }
          }
        }

        return byArea({
          columns: columns as AREA_DATASET_COLUMN[],
          dataSetResultId,
          yearFilter,
          areaFilter,
          filterConditions,
          pagination: {
            limit,
            offset,
          },
          orderBy,
          selectedDate,
          columnMapping:
            Object.keys(areaColumnMapping).length > 0
              ? areaColumnMapping
              : undefined,
          threshold,
        });
      }

      throw new Error("Invalid unit");
    },
    {
      operation: "filterDataSetForTable",
      data: {
        unit: view.unit,
        dataSetResultId: view.dataSetResultId,
        pagination: { limit, offset },
      },
    },
  );
}) satisfies IpcMainListener;

type ByArea = {
  columns: AREA_DATASET_COLUMN[];
  dataSetResultId: number;
  yearFilter: YearFilter | undefined;
  areaFilter: AreaFilter | undefined;
  filterConditions: FilterCondition[];
  pagination: PaginationQuery;
  columnMapping?: Record<string, string>;
  orderBy?: OrderByQuery<
    keyof SelectDataSetDetailBuilding | keyof SelectDataSetDetailArea
  > | null;
  selectedDate?: string;
  threshold?: ThresholdValue;
};

/**
 * area_groupごとの集計用セレクトフィールドを構築
 * 同一area_groupの複数レコード（飛び地）を1行に集計する
 * columnMappingが指定された場合、元のカラム名をキーとして解決されたカラム名でDBクエリを実行
 */
const buildAreaGroupBySelectFields = (
  columns: AREA_DATASET_COLUMN[],
  columnMapping?: Record<string, string>,
): Record<
  string,
  ReturnType<typeof avg> | typeof data_set_detail_areas.area_group
> => {
  const selectFields: Record<string, unknown> = {
    // 代表IDを保持（既存の行クリック処理との互換性のため）
    id: min(data_set_detail_areas.id),
  };

  for (const column of columns) {
    if (column === "area_group") {
      // グループ化キーはそのまま
      selectFields[column] = data_set_detail_areas.area_group;
    } else {
      // カラムマッピングがある場合、実際のカラム名でクエリし、元のカラム名でエイリアス
      const resolvedColumn = columnMapping?.[column] ?? column;
      if (columnMapping && resolvedColumn !== column) {
        selectFields[column] = sql.raw(`${resolvedColumn}`).as(column);
      } else {
        selectFields[column] = data_set_detail_areas[column];
      }
    }
  }

  return selectFields as Record<
    string,
    ReturnType<typeof avg> | typeof data_set_detail_areas.area_group
  >;
};

const byArea = async (params: ByArea): Promise<TableProps> => {
  const {
    columns,
    dataSetResultId,
    yearFilter,
    areaFilter,
    filterConditions,
    pagination: { limit, offset },
    orderBy,
    selectedDate,
    columnMapping,
    threshold,
  } = params;

  const whereConditions = and(
    eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
    selectedDate
      ? eq(data_set_detail_areas.reference_date, selectedDate)
      : undefined,
    yearFilter?.value.start
      ? gte(
          data_set_detail_areas.reference_date,
          `${yearFilter.value.start}-01-01`,
        )
      : undefined,
    yearFilter?.value.end
      ? lte(
          data_set_detail_areas.reference_date,
          `${yearFilter.value.end}-12-31`,
        )
      : undefined,
    ...filterQueryBuilder({
      conditions: filterConditions ?? [],
      threshold,
      unit: "area",
    }),
    or(
      // 地域区分文字列のリストからeq条件を作成
      ...(areaFilter?.value ?? []).map((area) =>
        eq(data_set_detail_areas.area_group, area),
      ),
    ),
  );

  // GROUP BY area_group用のセレクトフィールドを構築（閾値に基づくカラムマッピングを適用）
  const selectFields = buildAreaGroupBySelectFields(columns, columnMapping);

  const orderByConditions = (() => {
    if (!orderBy) {
      return asc(data_set_detail_areas.area_group);
    }

    const column = orderBy.column as AREA_DATASET_COLUMN;
    if (column in AREA_DATASET_COLUMN_METADATA) {
      const metadata = AREA_DATASET_COLUMN_METADATA[column];

      // GROUP BY集計と同じ集計関数を使用してソート
      const aggregatedColumn = (() => {
        if (column === "area_group") {
          return data_set_detail_areas.area_group;
        } else if (metadata.type === "float") {
          return avg(data_set_detail_areas[column]);
        } else if (metadata.type === "integer") {
          return sum(data_set_detail_areas[column]);
        } else {
          return min(data_set_detail_areas[column]);
        }
      })();

      return orderBy.direction === "ascending"
        ? asc(aggregatedColumn)
        : desc(aggregatedColumn);
    }

    return asc(data_set_detail_areas.area_group);
  })();

  const all = await benchmarkedQuery(
    `filterAreas_data_${dataSetResultId}`,
    () =>
      db
        .select(selectFields)
        .from(data_set_detail_areas)
        .where(whereConditions)
        .groupBy(data_set_detail_areas.area_group)
        .limit(limit)
        .offset(offset)
        .orderBy(orderByConditions),
  );

  const formattedColumns = columns.map((column) => {
    const columnMetadata = AREA_DATASET_COLUMN_METADATA[column];
    return {
      key: column,
      label: columnMetadata.label,
      unit: columnMetadata.unit,
    };
  });

  const data = (all as Array<Record<string, unknown>>).map(
    (row: Record<string, unknown>) => {
      const rowArray = Object.entries(row);
      const formattedRow = rowArray.reduce((acc, [key, value]) => {
        const metadata = getColumnMetadata({
          key,
          unit: "area",
        });

        return {
          ...acc,
          [key]: formatTableValue(value as string | number | null, metadata),
        };
      }, {});

      return formattedRow;
    },
  );

  // カウントクエリを並列実行
  // filteredCount: フィルター条件に該当するユニークなarea_group数
  // totalCount: 全体のユニークなarea_group数
  const { filteredCount: areaFilteredCount, totalCount: areaTotalCount } =
    await optimizedTableQuery.getDataWithCounts({
      dataQuery: async () => data, // 既に取得済みのデータを返す
      countQueries: {
        filtered: async () =>
          benchmarkedQuery(`filterAreas_count_${dataSetResultId}`, () =>
            db
              .select({
                count: countDistinct(data_set_detail_areas.area_group),
              })
              .from(data_set_detail_areas)
              .where(whereConditions),
          ),
        total: async () =>
          benchmarkedQuery(`filterAreas_total_${dataSetResultId}`, () =>
            db
              .select({
                count: countDistinct(data_set_detail_areas.area_group),
              })
              .from(data_set_detail_areas)
              .where(
                and(
                  eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
                ),
              ),
          ),
      },
      context: { operation: "filterAreasTable", table: "areas" },
    });

  return {
    columns: formattedColumns,
    data,
    totalCount: areaFilteredCount,
    allCount: areaTotalCount,
  };
};
