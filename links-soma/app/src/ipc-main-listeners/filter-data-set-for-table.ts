import { and, eq, gte, lte, or } from "drizzle-orm";
import { data_set_detail_areas, data_set_detail_buildings } from "../schema";
import { db } from "../utils/db";
import { columnsToSelectField } from "../utils/columns-to-select-field";
import { type TableProps } from "../@types/charts";
import {
  AREA_DATASET_COLUMN_METADATA,
  BUILDING_DATASET_COLUMN_METADATA,
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../config/column-metadata";

import { formatTableValue } from "../utils/format-table-value";
import { getColumnMetadata } from "../utils/get-column-metadata";
import { type TableView } from "../bi-modules/interfaces/view";
import { type FilterCondition } from "../bi-modules/interfaces/parameter";
import { filterQueryBuilder } from "../bi-modules/api/builder/filter-query-builder";
import { type IpcMainListener } from ".";

type FilterDataSetForTableResponse = TableProps;

interface BaseProps {
  view: TableView;
  pagination: {
    limit: number;
    offset: number;
  };
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
  view: TableView;
  pagination: {
    limit: number;
    offset: number;
  };
};

export const filterDataSetForTable = (async (
  _: unknown,
  { view, pagination: { limit, offset } }: Params,
): Promise<FilterDataSetForTableResponse> => {
  const { dataSetResultId, parameters, unit } = view;
  const yearFilter = parameters.find((p) => p.key === "year");
  const areaFilter = parameters.find((p) => p.key === "area");
  const filterConditions = parameters.filter((p): p is FilterCondition =>
    p.key.startsWith("filter_"),
  );
  const columns =
    parameters.find((p) => p.key === "columns")?.value.split(",") ?? [];

  if (unit === "building") {
    const all = await db
      .select(
        columnsToSelectField({
          type: "building",
          columns: columns as BUILDING_DATASET_COLUMN[],
        }),
      )
      .from(data_set_detail_buildings)
      .where(
        and(
          eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
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
          ...filterQueryBuilder({ conditions: filterConditions ?? [] }),
          or(
            // 地域区分文字列のリストからeq条件を作成
            ...(areaFilter?.value ?? []).map((area) =>
              eq(data_set_detail_buildings.area_group, area),
            ),
          ),
        ),
      )
      .limit(limit)
      .offset(offset)
      .all();

    return {
      columns: columns.map((column) => {
        const columnMetadata =
          BUILDING_DATASET_COLUMN_METADATA[column as BUILDING_DATASET_COLUMN];
        return {
          key: column,
          label: columnMetadata.label,
          unit: columnMetadata.unit,
        };
      }),
      data: all.map((row) => {
        const rowArray = Object.entries(row);
        const formattedRow = rowArray.reduce((acc, [key, value]) => {
          const metadata = getColumnMetadata({
            key,
            unit,
          });
          return {
            ...acc,
            [key]: formatTableValue(value, metadata),
          };
        }, {});

        return formattedRow;
      }),
    };
  }

  if (unit === "area") {
    const all = db
      .select(
        columnsToSelectField({
          type: "area",
          columns: columns as AREA_DATASET_COLUMN[],
        }),
      )
      .from(data_set_detail_areas)
      .where(
        and(
          eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
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
          ...filterQueryBuilder({ conditions: filterConditions ?? [] }),
          or(
            // 地域区分文字列のリストからeq条件を作成
            ...(areaFilter?.value ?? []).map((area) =>
              eq(data_set_detail_areas.area_group, area),
            ),
          ),
        ),
      )
      .limit(limit)
      .offset(offset)
      .all();

    return {
      columns: columns.map((column) => {
        const columnMetadata =
          AREA_DATASET_COLUMN_METADATA[column as AREA_DATASET_COLUMN];
        return {
          key: column,
          label: columnMetadata.label,
          unit: columnMetadata.unit,
        };
      }),
      data: all.map((row) => {
        const rowArray = Object.entries(row);
        const formattedRow = rowArray.reduce((acc, [key, value]) => {
          const metadata = getColumnMetadata({
            key,
            unit,
          });

          return {
            ...acc,
            [key]: formatTableValue(value, metadata),
          };
        }, {});

        return formattedRow;
      }),
    };
  }

  return {
    columns: [],
    data: [],
  };
}) satisfies IpcMainListener;
