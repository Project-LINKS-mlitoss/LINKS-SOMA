export const OUTPUT_FILE_TYPES = [
  {
    name: "CSV",
    type: "csv",
  },
  {
    name: "GeoJSON",
    type: "geojson",
  },
  {
    name: "GeoPackage",
    type: "geopackage",
  },
] as const;

export const INPUT_FILE_TYPES = [
  {
    name: "CSV",
    type: "csv",
  },
  {
    name: "GeoPackage",
    type: "geopackage",
  },
  {
    name: "Shapefile",
    type: "shapefile",
  },
] as const;

export const PLATEAU_FILE_TYPES = [
  {
    name: "GeoPackage",
    type: "geopackage",
  },
  {
    name: "Shapefile",
    type: "shapefile",
  },
] as const;
