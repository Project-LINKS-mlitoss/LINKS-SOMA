import { wktToGeoJSON } from "betterknown";
import { type FeatureData } from "../../types";

/**
 * 地図表示用の最小限のデータ型（IPCハンドラーと同じ定義）
 */
export type MinimalBuildingData = {
  id: number;
  bldg_geometry: string | null;
  predicted_probability: number | null;
  lat_geocoding: number | null;
  lon_geocoding: number | null;
};

/**
 * 最小限プロパティ型
 */
export type MinimalBuildingProperties = {
  id: number;
  predicted_probability: number | null;
  bldg_geometry: string | null;
  lat_geocoding: number | null;
  lon_geocoding: number | null;
};

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
      bldg_geometry: data.bldg_geometry,
      lat_geocoding: data.lat_geocoding,
      lon_geocoding: data.lon_geocoding,
    },
  };
};
