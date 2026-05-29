/**
 * CSV生成の共通ユーティリティ
 */

export interface CsvColumn {
  key: string;
  label: string;
  unit?: string;
}

export type CsvRow = Record<string, string | number | null | undefined>;

/**
 * CSVヘッダー行を生成
 */
const generateCsvHeader = (columns: CsvColumn[]): string => {
  return columns
    .map((col) => {
      const headerLabel = col.unit ? `${col.label}(${col.unit})` : col.label;
      // CSVで特殊文字がある場合はダブルクォートで囲む
      return headerLabel.includes(",") ||
        headerLabel.includes('"') ||
        headerLabel.includes("\n")
        ? `"${headerLabel.replace(/"/g, '""')}"`
        : headerLabel;
    })
    .join(",");
};

/**
 * CSVデータ行を生成
 */
const generateCsvRow = (row: CsvRow, columns: CsvColumn[]): string => {
  return columns
    .map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) {
        return "";
      }
      const stringValue = String(value);
      // CSVで特殊文字がある場合はダブルクォートで囲む
      return stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
    })
    .join(",");
};

/**
 * 完全なCSV文字列を生成
 */
export const generateCsv = (columns: CsvColumn[], rows: CsvRow[]): string => {
  const header = generateCsvHeader(columns);
  const dataRows = rows.map((row) => generateCsvRow(row, columns));
  return [header, ...dataRows].join("\n");
};
