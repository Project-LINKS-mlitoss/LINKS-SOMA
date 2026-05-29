import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { decodeStream, encodeStream } from "iconv-lite";

/**
 * CSVファイルから指定されたカラムのユニークな値を取得する
 * @param filePath ファイルへの絶対パス
 * @param columnName 値を取得するカラム名
 */
export const readCSVColumnValues = async (
  filePath: string,
  columnName: string,
): Promise<string[]> => {
  const values = new Set<string>();
  let columnIndex = -1;
  let isFirstRow = true;

  const parser = createReadStream(filePath)
    .pipe(decodeStream("utf-8"))
    .pipe(encodeStream("utf-8"))
    .pipe(parse({ trim: true }));

  for await (const record of parser) {
    if (isFirstRow) {
      // ヘッダー行から対象カラムのインデックスを取得
      columnIndex = record.findIndex((header: string) => header === columnName);
      if (columnIndex === -1) {
        return [];
      }
      isFirstRow = false;
      continue;
    }

    // 対象カラムの値を取得
    const value = record[columnIndex];
    if (value && value !== "") {
      values.add(value);
    }
  }

  return Array.from(values).sort();
};
