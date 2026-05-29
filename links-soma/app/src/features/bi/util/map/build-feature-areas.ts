import { wktToGeoJSON } from "betterknown";
import { type SelectDataSetDetailArea } from "../../../../db/schema";
import { type FeatureData } from "../../types";

/**
 * 地域データのFeatureオブジェクトを構築する関数
 */
export const buildFeatureAreas = ({
  geometry,
  ...properties
}: SelectDataSetDetailArea): FeatureData | null => {
  const converted = wktToGeoJSON(geometry);
  if (!converted) return null;

  return {
    type: "Feature",
    geometry: converted,
    properties: {
      ...properties,
      geometry,
    },
  };
};
