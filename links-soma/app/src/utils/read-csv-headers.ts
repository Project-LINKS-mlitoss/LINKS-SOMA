import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { decodeStream, encodeStream } from "iconv-lite";
/**
 *
 * @param filePath ファイルへの絶対パス
 */
export const readCSVHeaders = async (filePath: string): Promise<string[]> => {
  const headers: string[] = [];

  // csv-parseがStreamで処理が出来るため、readStreamでparse処理を設定
  // from_line: 1, to_line: 1で1行目のみ取得
  // trimでエスケープ文字を削除
  const parser = createReadStream(filePath)
    .pipe(decodeStream("utf-8"))
    .pipe(encodeStream("utf-8"))
    .pipe(parse({ from_line: 1, to_line: 1, trim: true }));

  // recordsをawaitで取得すると1行ずつ処理されるため、headersに追加
  for await (const record of parser) {
    headers.push(...record);
  }

  return headers;
};
