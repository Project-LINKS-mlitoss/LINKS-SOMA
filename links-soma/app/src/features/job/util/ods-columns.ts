/**
 * 建物関連データが名寄せ結果へ追加したカラム名。
 *
 * 追加カラムはユーザーのCSVをそのまま取り込むため、ジョブのパラメータには住所カラムしか
 * 残らない。名寄せ結果CSVのヘッダから `_ods` で終わる列を実績として拾う。名寄せ処理は
 * 列名を日本語化する際も `_ods` だけは剥がさないため、結果側で同定できる。
 *
 * 取得は検証情報のダウンロードを押した時だけ行う。画面表示には使わないので、ジョブ詳細を
 * 開くたびにファイルを読みにいく必要がない。
 */

import {
  ODS_SUFFIX,
  toOdsDisplayName,
} from "../../../shared/types/optional-data-source";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

/** 名寄せ結果のカラム名一覧から追加カラムだけを抜き、表示名へ変換する */
export const toOdsColumnNames = (columns: string[] | undefined): string[] =>
  (columns ?? [])
    .filter((column) => column.endsWith(ODS_SUFFIX))
    .map(toOdsDisplayName);

/**
 * 名寄せ結果CSVのヘッダを読み、追加カラム名を返す。
 *
 * ヘッダ1行しか読まないので、結果が何十万行でもコストは変わらない。結果ファイルが
 * 削除されていれば空配列を返し、呼び出し側は行ごと出さない。
 */
export const fetchOdsColumns = async (fileName: string): Promise<string[]> => {
  try {
    const columns = (await window.ipcRenderer.invoke("readDatasetColumns", {
      filename: fileName,
    })) as string[] | undefined;
    return toOdsColumnNames(columns);
  } catch (error) {
    rendererLogger.error("Failed to read normalized dataset columns", {
      error,
    });
    return [];
  }
};
