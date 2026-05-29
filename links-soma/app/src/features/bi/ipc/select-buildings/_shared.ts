import { eq, gt, isNotNull, or, and, ne, type SQL } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { type BuildingQueryParamsWithLastId } from "../../types";
import { filterQueryBuilder } from "../../services";

export const conditionsBuilder = ({
  dataSetResultId,
  referenceDate,
  lastId,
  areas,
  filterConditions,
  threshold,
  geometryNotNull,
}: BuildingQueryParamsWithLastId): (SQL<unknown> | undefined)[] => {
  const conditions: (SQL<unknown> | undefined)[] = [
    eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
  ];

  if (referenceDate) {
    conditions.push(
      eq(data_set_detail_buildings.reference_date, referenceDate),
    );
  }

  if (lastId) {
    conditions.push(gt(data_set_detail_buildings.id, lastId));
  }

  if (areas && areas.length > 0) {
    conditions.push(
      or(
        ...areas.map((area) => eq(data_set_detail_buildings.area_group, area)),
      ),
    );
  }

  // ジオメトリ情報がすべて存在するレコードのみを取得
  if (geometryNotNull) {
    conditions.push(
      and(
        isNotNull(data_set_detail_buildings.bldg_geometry),
        ne(data_set_detail_buildings.bldg_geometry, ""),
        isNotNull(data_set_detail_buildings.lat_geocoding),
        isNotNull(data_set_detail_buildings.lon_geocoding),
      ),
    );
  }

  const filterResults = filterQueryBuilder({
    conditions: filterConditions ?? [],
    threshold,
    unit: "building",
  });
  if (filterResults.length > 0) {
    conditions.push(...filterResults);
  }

  return conditions;
};
