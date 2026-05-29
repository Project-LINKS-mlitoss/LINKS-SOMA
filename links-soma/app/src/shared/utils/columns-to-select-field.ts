import { sql } from "drizzle-orm";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../db/schema";

/**
 * 表形式スタイル表示用のカラム配列から, DrizzleのSelectField用の連想配列に変換する
 * columnMappingが指定された場合、元のカラム名をキーとして解決されたカラム名でDBクエリを実行
 */
export const columnsToSelectField = ({
  type,
  columns,
  columnMapping,
}:
  | {
      type: "building";
      columns: (keyof SelectDataSetDetailBuilding)[];
      columnMapping?: Record<string, string>;
    }
  | {
      type: "area";
      columns: (keyof SelectDataSetDetailArea)[];
      columnMapping?: Record<string, string>;
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type --  返り値が複雑なため型定義を省略
    }) => {
  if (type === "building") {
    return Object.fromEntries(
      columns.map((column) => {
        const resolvedColumn = columnMapping?.[column] ?? column;
        // カラムマッピングがある場合、実際のカラム名でクエリし、元のカラム名でエイリアス
        if (columnMapping && resolvedColumn !== column) {
          return [column, sql.raw(`${resolvedColumn}`).as(column)];
        }
        return [column, data_set_detail_buildings[column]];
      }),
    );
  }

  if (type === "area") {
    return Object.fromEntries(
      columns.map((column) => {
        const resolvedColumn = columnMapping?.[column] ?? column;
        // カラムマッピングがある場合、実際のカラム名でクエリし、元のカラム名でエイリアス
        if (columnMapping && resolvedColumn !== column) {
          return [column, sql.raw(`${resolvedColumn}`).as(column)];
        }
        return [column, data_set_detail_areas[column]];
      }),
    );
  }

  return {};
};
