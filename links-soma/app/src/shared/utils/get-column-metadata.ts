import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
  type BUILDING_DATASET_COLUMN,
  BUILDING_DATASET_COLUMN_METADATA,
  type ColumnMetadataValue,
} from "../config/column-metadata";

export const getColumnMetadata = ({
  unit,
  key,
}: {
  unit: "building" | "area";
  key: string;
}): ColumnMetadataValue | null => {
  if (unit === "building") {
    return key in BUILDING_DATASET_COLUMN_METADATA
      ? BUILDING_DATASET_COLUMN_METADATA[key as BUILDING_DATASET_COLUMN]
      : null;
  } else {
    return key in AREA_DATASET_COLUMN_METADATA
      ? AREA_DATASET_COLUMN_METADATA[key as AREA_DATASET_COLUMN]
      : null;
  }
};
