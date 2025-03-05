import { eq } from "drizzle-orm";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  type SelectDataSetResult,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export type FetchAreaGroupsArg = {
  dataSetResultId: SelectDataSetResult["id"] | undefined;
  unit: "building" | "area";
};

export const selectAreaGroups = (async (
  _: unknown,
  props: FetchAreaGroupsArg,
): Promise<string[]> => {
  if (props.dataSetResultId === undefined) return [];

  const result =
    props.unit === "building"
      ? await db
          .selectDistinct({
            area_group: data_set_detail_buildings.area_group,
          })
          .from(data_set_detail_buildings)
          .where(
            eq(
              data_set_detail_buildings.data_set_result_id,
              props.dataSetResultId,
            ),
          )
      : await db
          .selectDistinct({
            area_group: data_set_detail_areas.area_group,
          })
          .from(data_set_detail_areas)
          .where(
            eq(data_set_detail_areas.data_set_result_id, props.dataSetResultId),
          );

  const areas = result.map((r) => r.area_group);
  return areas.filter((g): g is string => g !== null && g !== "").sort();
}) satisfies IpcMainListener;
