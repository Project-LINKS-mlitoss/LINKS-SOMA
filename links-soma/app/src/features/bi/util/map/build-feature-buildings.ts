import { wktToGeoJSON } from "betterknown";
import { type SelectDataSetDetailBuilding } from "../../../../db/schema";
import { type FeatureData } from "../../types";
import { type BuildingProperties } from "../../components/views/map/map-container/_components/building-popup";

/**
 * 建物データのFeatureオブジェクトを構築する関数
 * bldg_geometryがnullまたは空文字の場合はnullを返す
 */
export const buildFeatureBuildings = ({
  bldg_geometry,
  ...properties
}: SelectDataSetDetailBuilding): FeatureData<BuildingProperties> | null => {
  // ジオメトリがnullまたは空の場合はスキップ
  if (!bldg_geometry) return null;

  const converted = wktToGeoJSON(bldg_geometry);
  if (!converted) return null;

  return {
    type: "Feature",
    geometry: converted,
    properties: {
      ...properties,
      bldg_geometry,
    },
  };
};
