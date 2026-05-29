import { eq, gt, or, type SQL } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { type AreaQueryParamsWithLastId } from "../../types";
import { filterQueryBuilder } from "../../services";

export const conditionsBuilder = ({
  dataSetResultId,
  referenceDate,
  lastId,
  areas,
  filterConditions,
  threshold,
}: AreaQueryParamsWithLastId): (SQL<unknown> | undefined)[] => {
  const conditions: (SQL<unknown> | undefined)[] = [
    eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
  ];

  if (referenceDate) {
    conditions.push(eq(data_set_detail_areas.reference_date, referenceDate));
  }

  if (lastId) {
    conditions.push(gt(data_set_detail_areas.id, lastId));
  }

  if (areas && areas.length > 0) {
    conditions.push(
      or(...areas.map((area) => eq(data_set_detail_areas.area_group, area))),
    );
  }

  const filterResults = filterQueryBuilder({
    conditions: filterConditions ?? [],
    threshold,
    unit: "area",
  });
  if (filterResults.length > 0) {
    conditions.push(...filterResults);
  }

  return conditions;
};
