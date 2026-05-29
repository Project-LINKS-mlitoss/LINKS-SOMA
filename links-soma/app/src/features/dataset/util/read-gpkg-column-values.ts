import Database from "better-sqlite3";

/**
 * GeoPackageファイルから指定されたカラムのユニークな値を取得する
 * better-sqlite3を使用してSELECT DISTINCTで高速に取得
 * @param filePath ファイルへの絶対パス
 * @param columnName 値を取得するカラム名
 */
export const readGPKGColumnValues = async (
  filePath: string,
  columnName: string,
): Promise<string[] | undefined> => {
  const db = new Database(filePath, { readonly: true });
  const values = new Set<string>();

  try {
    // GeoPackageのメタデータからfeatureテーブル一覧を取得
    const tables = db
      .prepare(
        `SELECT table_name FROM gpkg_contents WHERE data_type = 'features'`,
      )
      .all() as { table_name: string }[];

    for (const { table_name } of tables) {
      // テーブルにカラムが存在するか確認
      const columns = db
        .prepare(`PRAGMA table_info("${table_name}")`)
        .all() as {
        name: string;
      }[];
      const hasColumn = columns.some((col) => col.name === columnName);

      if (hasColumn) {
        // SELECT DISTINCTで効率的にユニーク値を取得
        const rows = db
          .prepare(
            `SELECT DISTINCT "${columnName}" AS value FROM "${table_name}" WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''`,
          )
          .all() as { value: string | number }[];

        for (const row of rows) {
          values.add(String(row.value));
        }
      }
    }

    const result = Array.from(values).sort();
    // 選択肢が存在しない場合はundefinedを返す
    return result.length > 0 ? result : undefined;
  } finally {
    db.close();
  }
};
