import { wktToGeoJSON } from "betterknown";
import { type FeatureData } from "../../types";
import { type MinimalBuildingData } from "../../ipc/select-buildings/select-buildings-viewport-chunk";

export { type MinimalBuildingData };

/**
 * 最小限プロパティ型。地図に載せる値は取得元と同一で、順序だけが違う
 */
export type MinimalBuildingProperties = MinimalBuildingData;

/**
 * 最小限の建物データからFeatureDataを構築（レンダラー側でWKT変換）
 */
export const buildFeatureFromMinimal = (
  data: MinimalBuildingData,
): FeatureData<MinimalBuildingProperties> | null => {
  if (!data.bldg_geometry) return null;

  const converted = wktToGeoJSON(data.bldg_geometry);
  if (!converted) return null;

  return {
    type: "Feature",
    geometry: converted,
    properties: {
      id: data.id,
      predicted_probability: data.predicted_probability,
      predicted_probability_change_rate_from_oldest:
        data.predicted_probability_change_rate_from_oldest,
      predicted_probability_change_rate_from_previous:
        data.predicted_probability_change_rate_from_previous,
      bldg_geometry: data.bldg_geometry,
      lat_geocoding: data.lat_geocoding,
      lon_geocoding: data.lon_geocoding,
    },
  };
};
