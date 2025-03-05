import {
  data_set_detail_areas,
  data_set_detail_buildings,
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../schema";

/**
 * 表形式スタイル表示用のカラム配列から, DrizzleのSelectField用の連想配列に変換する
 */
export const columnsToSelectField = ({
  type,
  columns,
}:
  | { type: "building"; columns: (keyof SelectDataSetDetailBuilding)[] }
  | {
      type: "area";
      columns: (keyof SelectDataSetDetailArea)[];
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type --  返り値が複雑なため型定義を省略
    }) => {
  if (type === "building") {
    return Object.fromEntries(
      columns.map((column) => [column, data_set_detail_buildings[column]]),
    );
  }

  if (type === "area") {
    return Object.fromEntries(
      columns.map((column) => [column, data_set_detail_areas[column]]),
    );
  }

  return {};
};
