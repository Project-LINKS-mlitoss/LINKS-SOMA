import { type FormNormalizationType } from "../hooks/use-form-normalization";

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
];

export const BUILDING_FILE_TYPES: {
  name: string;
  type: FormNormalizationType["data"]["building_polygon"]["input_file_type"];
}[] = [
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
];
