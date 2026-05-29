import columnTranslations from "./column-translations.json";

/**
 * カラム名変換ユーティリティ
 *
 * Issue #1011の決定事項：
 * - JSONファイル形式を採用
 * - Python側の日本語ラベルを優先
 * - 両言語に存在するカラムも、片方にしか存在しないカラムも含める
 */

export type DatasetType = "building" | "area";

// JSON構造の型定義
type ColumnTranslations = {
  building: Record<string, string>;
  area: Record<string, string>;
};

const translations = columnTranslations as ColumnTranslations;

/**
 * 英語カラム名から日本語カラム名への変換
 * @param columnName 英語カラム名
 * @param datasetType データセットの種類（building/area）
 * @returns 日本語カラム名（見つからない場合は元のカラム名を返す）
 */
export function translateColumnToJapanese(
  columnName: string,
  datasetType: DatasetType,
): string {
  const datasetTranslations = translations[datasetType];
  return datasetTranslations[columnName] || columnName;
}

/**
 * 日本語カラム名から英語カラム名への逆変換
 * @param japaneseName 日本語カラム名
 * @param datasetType データセットの種類（building/area）
 * @returns 英語カラム名（見つからない場合は元の日本語名を返す）
 */
export function translateColumnToEnglish(
  japaneseName: string,
  datasetType: DatasetType,
): string {
  const datasetTranslations = translations[datasetType];

  // 逆引きマップを作成
  const reverseMap = Object.entries(datasetTranslations).reduce(
    (acc, [englishKey, japaneseValue]) => {
      acc[japaneseValue] = englishKey;
      return acc;
    },
    {} as Record<string, string>,
  );

  return reverseMap[japaneseName] || japaneseName;
}

/**
 * カラム名が英語カラム名かどうかを判定
 * @param columnName カラム名
 * @param datasetType データセットの種類（building/area）
 * @returns 英語カラム名として存在する場合はtrue
 */
export function isEnglishColumn(
  columnName: string,
  datasetType: DatasetType,
): boolean {
  const datasetTranslations = translations[datasetType];
  return columnName in datasetTranslations;
}
