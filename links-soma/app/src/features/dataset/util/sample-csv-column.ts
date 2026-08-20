import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { decodeStream, encodeStream } from "iconv-lite";
import type { SampleColumn } from "../../normalization/pre-validation";

/**
 * CSVの指定カラムを先頭 sampleSize 行までサンプリングする（事前軽量チェック用）。
 *
 * `readCSVColumnValues` と異なり、出現順を保ち・空文字も含め・打ち切りを記録する
 * （事前バリデーションの片側性は `truncated` で確定する）。対象カラムが無ければ
 * null を返し、呼び出し側（エンジン）が unknown として事後に委ねる。
 *
 * @param filePath ファイルへの絶対パス
 * @param columnName サンプリングするカラム名
 * @param sampleSize 取得する最大データ行数
 */
export const sampleCSVColumn = async (
  filePath: string,
  columnName: string,
  sampleSize: number,
): Promise<SampleColumn | null> => {
  const values: string[] = [];
  let columnIndex = -1;
  let isFirstRow = true;
  let truncated = false;

  const parser = createReadStream(filePath)
    .pipe(decodeStream("utf-8"))
    .pipe(encodeStream("utf-8"))
    .pipe(parse({ trim: true }));

  for await (const record of parser) {
    if (isFirstRow) {
      columnIndex = record.findIndex((header: string) => header === columnName);
      if (columnIndex === -1) {
        return null;
      }
      isFirstRow = false;
      continue;
    }

    if (values.length >= sampleSize) {
      // sampleSize を超える行が存在する = 打ち切り
      truncated = true;
      break;
    }
    values.push(record[columnIndex] ?? "");
  }

  return { values, truncated };
};
