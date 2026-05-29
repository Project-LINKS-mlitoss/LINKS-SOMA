import { type Geometry } from "geojson";

export const getLngLatFromGeometry = (geometry: Geometry): [number, number] => {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates[0], geometry.coordinates[1]];

    case "MultiPoint":
    case "LineString":
      return [
        geometry.coordinates[Math.floor(geometry.coordinates.length / 2)][0],
        geometry.coordinates[Math.floor(geometry.coordinates.length / 2)][1],
      ];

    case "MultiLineString":
    case "Polygon":
      return [
        geometry.coordinates[0][
          Math.floor(geometry.coordinates[0].length / 2)
        ][0],
        geometry.coordinates[0][
          Math.floor(geometry.coordinates[0].length / 2)
        ][1],
      ];

    case "MultiPolygon":
      return [
        geometry.coordinates[0][0][
          Math.floor(geometry.coordinates[0][0].length / 2)
        ][0],
        geometry.coordinates[0][0][
          Math.floor(geometry.coordinates[0][0].length / 2)
        ][1],
      ];

    case "GeometryCollection": {
      for (const g of geometry.geometries) {
        try {
          return getLngLatFromGeometry(g);
        } catch {
          continue;
        }
      }
      throw new Error("No valid point found in GeometryCollection");
    }

    default:
      throw new Error(`Unsupported geometry type`);
  }
};
