import { wktToGeoJSON } from "betterknown";
import { type LngLatLike } from "maplibre-gl";
import { type SelectDataSetDetailBuilding } from "../../../../db/schema";

export async function getCenter(
  bldg_geometry: SelectDataSetDetailBuilding["bldg_geometry"] | undefined,
): Promise<LngLatLike | undefined> {
  if (!bldg_geometry) return;

  const geojson = wktToGeoJSON(bldg_geometry);
  if (!geojson) return;
  const center: LngLatLike | undefined = (() => {
    if (!geojson) return;
    if (geojson.type === "Polygon") {
      const [lng, lat] = geojson.coordinates[0][0];
      return [lng, lat];
    }
    if (geojson.type === "MultiPolygon") {
      const [lng, lat] = geojson.coordinates[0][0][0];
      return [lng, lat];
    }
    return;
  })();

  return center;
}
