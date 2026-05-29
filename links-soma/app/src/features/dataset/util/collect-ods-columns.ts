import {
  type OptionalDataSourceEntry,
  ODS_SUFFIX,
} from "../../../shared/types/optional-data-source";

type CollectResult = {
  /** _odsカラムを除去した行 */
  row: Record<string, string>;
  /** _odsカラムから変換したエントリ。_odsカラムがなければnull */
  odsEntries: OptionalDataSourceEntry[] | null;
};

/**
 * CSV行から_odsサフィックスのカラムを分離し、OptionalDataSourceEntry[]に変換する。
 * 元の行オブジェクトは変更しない（イミュータブル）。
 */
export const collectOdsColumns = (
  row: Record<string, string>,
): CollectResult => {
  const odsKeys = Object.keys(row)
    .filter((key) => key.endsWith(ODS_SUFFIX))
    .sort();

  if (odsKeys.length === 0) {
    return { row, odsEntries: null };
  }

  const odsEntries: OptionalDataSourceEntry[] = odsKeys.map((key) => ({
    name: key.slice(0, -ODS_SUFFIX.length),
    value: row[key],
  }));

  const odsKeySet = new Set(odsKeys);
  const filteredRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!odsKeySet.has(key)) {
      filteredRow[key] = value;
    }
  }

  return { row: filteredRow, odsEntries };
};
