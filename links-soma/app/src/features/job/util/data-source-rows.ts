/**
 * 利用データ1件の表示値を組み立てる。
 *
 * 実行情報カード（画面）と検証情報ダウンロード（ファイル）の両方がここを参照する。
 * 片方だけで値を組み立てると、項目を足したときにもう片方が追随しない。
 */

import { lang } from "../../../shared/config/lang";
import { type DataSetFileStat } from "../hooks/use-fetch-data-set-file-stats";

const l = lang.components["job-parameters-section"];

/** データ種別（建物ポリゴンデータ）の表示値 */
export const DATA_TYPE_LABELS: Record<string, string> = {
  plateau: l.dataTypePlateau,
  others: l.dataTypeOthers,
};

/** 入力ファイル形式の表示値 */
export const FILE_TYPE_LABELS: Record<string, string> = {
  csv: "CSV",
  geopackage: "GeoPackage",
  shapefile: "Shapefile",
};

/** バイト数を人間可読サイズに変換する */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
};

/** データ量（行数・ファイルサイズ）の表示文字列。CSV以外は行数なし */
export const formatVolume = (
  stat: DataSetFileStat | undefined,
): string | undefined => {
  if (!stat) return undefined;
  const size = formatBytes(stat.bytes);
  return stat.rows != null ? `${stat.rows.toLocaleString()}行 / ${size}` : size;
};

/**
 * データソース行へ併記する付随情報（データ種別・ファイル形式）。
 * 同じ CSV でも取り込み方が違えば結果が変わるため、画面とファイルの両方に出す。
 * 入力データの種類ごとに持つ項目が違うので、有無を見てから取り出す。
 */
export const dataSourceExtras = (entry: object): string[] => {
  const extras: string[] = [];
  // 空文字は括弧の中身が空のまま出てしまうので値がある場合だけ足す
  const dataType = "data_type" in entry ? entry.data_type : undefined;
  if (typeof dataType === "string" && dataType) {
    extras.push(DATA_TYPE_LABELS[dataType] ?? dataType);
  }
  const fileType =
    "input_file_type" in entry ? entry.input_file_type : undefined;
  if (typeof fileType === "string" && fileType) {
    extras.push(FILE_TYPE_LABELS[fileType] ?? fileType);
  }
  return extras;
};

/**
 * 処理対象選定用データで推定対象に指定した家屋種別。
 *
 * 未指定でも文字列を返す。空配列は「未設定」ではなく「絞り込まず全件を種別不明として
 * 扱う」という状態で、行を落とすと絞ったのか記録漏れなのか受け取った側が区別できない。
 */
export const buildingTypeValuesText = (values: string[] | undefined): string =>
  values?.length ? values.join(" / ") : l.buildingTypeValuesNone;

/** 利用データ1行の値。ファイル名 + 付随情報 + データ量 */
export const dataSourceValueText = (
  fileName: string,
  entry: object,
  stat: DataSetFileStat | undefined,
): string => {
  const extras = dataSourceExtras(entry);
  const volume = formatVolume(stat);
  return `${fileName}${extras.length ? ` (${extras.join(", ")})` : ""}${volume ? `（${volume}）` : ""}`;
};
