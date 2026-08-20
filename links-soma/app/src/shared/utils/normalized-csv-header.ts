import {
  translateColumnToJapanese,
  translateColumnToEnglish,
} from "../column-translation-utils";
import { ODS_DISPLAY_PREFIX, ODS_SUFFIX } from "../types/optional-data-source";

/**
 * 名寄せ済みデータCSVのヘッダを、ディスク上の列名と画面の表示名の間で読み替える。
 *
 * ディスク上の列名は ML が決める（`ml/async_tasks/constants.py` の
 * `TRANSLATE_COLUMNS_IF001`）。大半は日本語だが、空き家調査結果の5列と
 * 建物関連データの `_ods` だけが英語のまま残る。ML 側で日本語化すると
 * モデル構築のラベル列参照・`MAPPING_E022_TO_IF001`・検証ラボまで波及するため、
 * 利用者との境界でのみ読み替える（ADR-0029）。
 *
 * 読み替えは対称に保つこと。ダウンロードだけ変えるとアップロードで壊れる。
 */

/**
 * 読み替え対象のディスク上の列名
 *
 * 表示名は `column-translations.json`（building）から引く。ここに列挙しない列は
 * 素通りさせる。`reference_date` のように、ML と DB で意味が異なる列を巻き込まないため。
 */
const TRANSLATED_COLUMNS = [
  "is_vacant",
  "vacant_type",
  "vacant_source",
  "vacant_year",
  "address_precision_flag",
] as const;

const toDisplayName = (columnName: string): string => {
  if (columnName.endsWith(ODS_SUFFIX)) {
    return `${ODS_DISPLAY_PREFIX}${columnName.slice(0, -ODS_SUFFIX.length)}`;
  }
  if ((TRANSLATED_COLUMNS as readonly string[]).includes(columnName)) {
    return translateColumnToJapanese(columnName, "building");
  }
  return columnName;
};

const toStorageName = (columnName: string): string => {
  if (columnName.startsWith(ODS_DISPLAY_PREFIX)) {
    return `${columnName.slice(ODS_DISPLAY_PREFIX.length)}${ODS_SUFFIX}`;
  }
  const englishName = translateColumnToEnglish(columnName, "building");
  return (TRANSLATED_COLUMNS as readonly string[]).includes(englishName)
    ? englishName
    : columnName;
};

/**
 * ヘッダ行のセルを読み替える。
 *
 * 末尾の CR は読み替えの対象外にして戻す。IF001 は pandas の `to_csv` で書き出し、
 * 改行は実行OSに従う（本番の Windows では CRLF）。CR を含めたまま分割すると
 * 最後の列だけ一致せず、対称性が崩れる。
 */
const mapHeaderLine = (
  headerLine: string,
  mapper: (columnName: string) => string,
): string => {
  const hasCr = headerLine.endsWith("\r");
  const line = hasCr ? headerLine.slice(0, -1) : headerLine;
  const mapped = line.split(",").map(mapper).join(",");
  return hasCr ? `${mapped}\r` : mapped;
};

/** ヘッダ行のセルを表示名へ読み替える */
export const toDisplayHeaderLine = (headerLine: string): string =>
  mapHeaderLine(headerLine, toDisplayName);

/** ヘッダ行のセルをディスク上の列名へ読み替える */
export const toStorageHeaderLine = (headerLine: string): string =>
  mapHeaderLine(headerLine, toStorageName);

/** 置換文字。UTF-8 として解釈できないバイトがあると現れる */
const REPLACEMENT_CHARACTER = "�";

/**
 * CSVのバイト列を、ヘッダ行と本文に分けて返す。読み替えが不要なら1要素で返す。
 *
 * 本文は触らないため、行数に関係なく先頭1行の再エンコードで済む。分割したまま返すのは
 * 数百MBのファイルで全体のコピーを増やさないため。Blob へはそのまま渡せる。
 *
 * BOM はヘッダ行の先頭セルに含まれたまま素通りする（読み替え対象の列名は先頭に来ない）。
 *
 * 以下は元のバイト列をそのまま返す。
 * - 改行が見つからない
 * - ヘッダが UTF-8 として解釈できない（Shift_JIS 等）。読み替えると本文と食い違い、
 *   日本語の列名が置換文字で壊れる。取り込みは非UTF-8を許容している（PV-01）
 * - 読み替える列が無い
 */
export const translateCsvHeaderParts = (
  bytes: Uint8Array,
  translate: (headerLine: string) => string,
): Uint8Array[] => {
  const newline = bytes.indexOf(0x0a);
  if (newline === -1) return [bytes];

  const headerLine = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
    bytes.subarray(0, newline),
  );
  if (headerLine.includes(REPLACEMENT_CHARACTER)) return [bytes];

  const translated = translate(headerLine);
  if (translated === headerLine) return [bytes];

  return [new TextEncoder().encode(translated), bytes.subarray(newline)];
};

/** ヘッダ行を読み替えた1本のバイト列を返す。連結が要る用途（保存）向け */
export const translateCsvHeaderBytes = (
  bytes: Uint8Array,
  translate: (headerLine: string) => string,
): Uint8Array => {
  const parts = translateCsvHeaderParts(bytes, translate);
  if (parts.length === 1) return parts[0];

  const [header, body] = parts;
  const result = new Uint8Array(header.length + body.length);
  result.set(header);
  result.set(body, header.length);
  return result;
};
