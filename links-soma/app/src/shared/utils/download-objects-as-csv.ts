type ObjectType = Record<string, string | number | boolean | null>;

/**
 * オブジェクトの配列をCSVファイルとしてダウンロードする
 * @param objects 変換対象のオブジェクトの配列
 * @param fileName ダウンロードするファイル名（.csvは自動で付加）
 */
export function downloadObjectsAsCSV(
  objects: ObjectType[],
  fileName: string,
): void {
  // CSVデータの生成
  const csvContent = objectsToCSV(objects);

  // Excelで開いた際も文字化けしないようBOMを追加してUTF-8でエンコード
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" });

  // ダウンロードリンクの作成
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;

  // ダウンロードの実行
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // URLオブジェクトの解放
  URL.revokeObjectURL(link.href);
}

/**
 * オブジェクトの配列をCSV文字列に変換する
 * @param objects 変換対象のオブジェクトの配列
 * @returns CSV形式の文字列
 */
const objectsToCSV = (objects: ObjectType[]): string => {
  if (!objects.length) return "";

  const csvHeaders = Object.keys(objects[0]);

  // ヘッダー行の作成
  const headerRow = csvHeaders.join(",");

  // データ行の作成
  const rows = objects.map((obj) => {
    return csvHeaders
      .map((header) => {
        const value = obj[header];
        // 値をCSVセル形式に変換
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          // カンマやダブルクォートを含む場合は適切にエスケープ
          if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n")
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }
        return String(value);
      })
      .join(",");
  });

  // ヘッダーとデータ行を結合
  return [headerRow, ...rows].join("\n");
};
