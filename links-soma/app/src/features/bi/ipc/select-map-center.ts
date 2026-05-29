import { eq } from "drizzle-orm";
import { data_set_detail_buildings, result_views } from "../../../db/schema";
import { db } from "../../../db/client";
import { type MapCenter } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  resultViewId: number;
};

type Return = {
  mapCenter: MapCenter | undefined;
};

export const selectMapCenter = (async (
  _: unknown,
  { resultViewId }: Params,
): Promise<Return> => {
  const res = db
    .select({
      data_set_result_id: result_views.data_set_result_id,
      parameters: result_views.parameters,
    })
    .from(result_views)
    .where(eq(result_views.id, resultViewId))
    .get();

  if (!res) {
    throw new Error(`Result view with ID ${resultViewId} not found.`);
  }

  const currentMapCenterParameter = res.parameters.find(
    (param) => param.key === "map_center",
  );
  if (currentMapCenterParameter) {
    return { mapCenter: currentMapCenterParameter };
  }

  const datasetsBuildng = db
    .select({
      lng: data_set_detail_buildings.lon_geocoding,
      lat: data_set_detail_buildings.lat_geocoding,
    })
    .from(data_set_detail_buildings)
    .where(
      eq(
        data_set_detail_buildings.data_set_result_id,
        res.data_set_result_id || 0,
      ),
    )
    .limit(1)
    .get();

  if (
    !datasetsBuildng ||
    datasetsBuildng.lng === null ||
    datasetsBuildng.lat === null
  ) {
    return { mapCenter: undefined };
  }

  return {
    mapCenter: {
      key: "map_center",
      type: "map",
      value: {
        lng: datasetsBuildng.lng,
        lat: datasetsBuildng.lat,
      },
    },
  };
}) satisfies IpcMainListener;
