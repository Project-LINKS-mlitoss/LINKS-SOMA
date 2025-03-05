import { type TileViewFieldOption } from "../@types/charts";
import { TILE_VIEW_CONFIG } from "../config/tile-view-config";

export const getResultViewFieldOption = (
  style: "pie" | "bar" | "line" | "table" | "map",
  key: string,
): TileViewFieldOption | undefined => {
  // ハードコーディングされたチャートごとの設定を取得
  const options = TILE_VIEW_CONFIG[style];

  // チャート設定からパラメーターフィールドに使う値を取得
  const optionFields = options ? options.fields : [];

  // 設定に含まれるパラメーターフィールドのうち、現在のフィールドに対応するものを取得
  // item.key -> パラメーターフィールドのキー
  // field.key -> map中のDBもしくはRHFで管理されているParamterオブジェクトのキー
  const optionField = optionFields.find((item) => item.key === key);

  return optionField;
};
