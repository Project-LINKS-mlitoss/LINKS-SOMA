import { Option } from "@fluentui/react-components";
import {
  type ChartDynamicColumnInput,
  type TileViewFieldOption,
} from "../../@types/charts";
import {
  AREA_DATASET_COLUMN_METADATA,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../config/column-metadata";

type Props = {
  unit: "building" | "area";
  fieldOption: TileViewFieldOption;
  type: ChartDynamicColumnInput;
};
/**
 * 指定した集計単位のデータと表示形式ごとに取得したfieldOptionから表示すべき選択肢となるカラムのオプションを自動生成する
 */
export const DynamicColumnOptions = ({
  unit,
  fieldOption,
  type,
}: Props): JSX.Element[] | null => {
  if (unit === "building") {
    const columns = fieldOption.option.filter((option) => {
      return option.unit === "building";
    });

    return columns.map(({ value: column }) => {
      const columnMetadata =
        column in BUILDING_DATASET_COLUMN_METADATA
          ? BUILDING_DATASET_COLUMN_METADATA[column]
          : null;

      if (columnMetadata === null) {
        return <></>;
      }

      if (type === "select") {
        return (
          <option key={column} value={column}>
            {columnMetadata.label}
          </option>
        );
      }
      if (type === "dropdown") {
        return (
          <Option key={column} text={columnMetadata.label} value={column}>
            {columnMetadata.label}
          </Option>
        );
      }

      return <></>;
    });
  } else {
    const columns = fieldOption.option.filter((option) => {
      return option.unit === "area";
    });

    return columns.map(({ value: column }) => {
      const columnMetadata =
        column in AREA_DATASET_COLUMN_METADATA
          ? AREA_DATASET_COLUMN_METADATA[column]
          : null;

      if (columnMetadata === null) {
        return <></>;
      }

      if (type === "select") {
        return (
          <option key={column} value={column}>
            {columnMetadata.label}
          </option>
        );
      }
      if (type === "dropdown") {
        return (
          <Option key={column} text={columnMetadata.label} value={column}>
            {columnMetadata.label}
          </Option>
        );
      }
      return <></>;
    });
  }
};
