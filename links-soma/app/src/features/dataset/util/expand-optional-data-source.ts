import {
  type OptionalDataSourceEntry,
  ODS_SUFFIX,
  toOdsDisplayName,
} from "../../../shared/types/optional-data-source";

type ColumnMeta = {
  key: string;
  label: string;
  unit: string;
};

type ExpandResult = {
  /** 追加カラムのメタデータ（既存columnsの後ろに連結して使用） */
  columns: ColumnMeta[];
  /** optional_data_sourceを展開済みのデータ行（元のフィールドも含む） */
  data: Record<string, unknown>[];
};

/**
 * クエリ結果のoptional_data_source（JSON配列）を個別カラムに展開する。
 *
 * 各行のoptional_data_source配列のentryを独立したフィールドに展開し、
 * 最初の非null行のentryからカラムメタデータを生成する。
 * optional_data_sourceがnull/未定義の行は、追加カラムの値を空文字にする。
 */
export const expandOptionalDataSource = (
  rows: Record<string, unknown>[],
): ExpandResult => {
  // 最初にoptional_data_sourceが非nullな行からカラム名リストを取得
  const firstEntries = rows
    .map((row) => row.optional_data_source as OptionalDataSourceEntry[] | null)
    .find((entries) => Array.isArray(entries) && entries.length > 0);

  const columnNames = firstEntries?.map((entry) => entry.name) ?? [];

  const columns: ColumnMeta[] = columnNames.map((name) => ({
    key: name,
    label: toOdsDisplayName(`${name}${ODS_SUFFIX}`),
    unit: "",
  }));

  const data = rows.map((row) => {
    const { optional_data_source, ...rest } = row;
    const entries = optional_data_source as
      | OptionalDataSourceEntry[]
      | null
      | undefined;

    if (!Array.isArray(entries)) {
      // null/未定義の行は追加カラムを空文字で埋める
      const emptyFields = Object.fromEntries(
        columnNames.map((name) => [name, ""]),
      );
      return { ...rest, ...emptyFields };
    }

    // 各entryをフィールドに展開
    const expandedFields = Object.fromEntries(
      entries.map((entry) => [entry.name, entry.value ?? ""]),
    );
    return { ...rest, ...expandedFields };
  });

  return { columns, data };
};
