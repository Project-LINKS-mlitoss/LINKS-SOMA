/** 進捗イベントのチャンネル名 */
export const CSV_IMPORT_PROGRESS_CHANNEL = "csv-import-progress";

/** データセットタイプ（building または area） */
export type CsvImportFileType = "building" | "area";

/** 進捗情報の型 */
export type CsvImportProgress =
  | { phase: "parsing"; fileType: CsvImportFileType; rowCount: number }
  | {
      phase: "inserting";
      fileType: CsvImportFileType;
      current: number;
      total: number;
    }
  | { phase: "completed"; fileType: CsvImportFileType }
  | { phase: "error"; fileType: CsvImportFileType; message: string };

/** ファイルごとのインポート結果 */
export type CsvImportFileResult = {
  fileName: string;
  rowCount: number;
  unmappedColumns: string[];
};

/** CSVインポートの結果 */
export type CsvImportResult = {
  title: string;
  building: CsvImportFileResult | null;
  area: CsvImportFileResult | null;
};
