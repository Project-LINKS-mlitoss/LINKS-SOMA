import { TILE_VIEW_CONFIG } from "../config/tile-view-config";
import { type ReferenceDate } from "../../../ipc-main-listeners/select-reference-dates";
import { type SelectResultView } from "../../../db/schema";
import { type Parameter } from "../types/models/parameter";
import { createDefaultLineGroupParameters } from "./create-default-line-group-parameters";
import { createDefaultPieGroupParameters } from "./create-default-pie-group-parameters";

export const createViewDefaultParameters = (
  style: SelectResultView["style"],
  unit: SelectResultView["unit"] = "area",
  referenceDates: ReferenceDate[] | undefined,
): Parameter[] => {
  if (!style) return [];

  /** データセットの状態に依存しないデフォルト設定を取得 */
  const config = TILE_VIEW_CONFIG[style];
  if (!config) return [];

  /** Parameterとして保存できるよう整形. */
  let parameters: (Parameter | null)[] = config.fields.map((field) => {
    switch (field.key) {
      case "xAxis":
        return {
          key: field.key,
          value: field.option[0].value,
          type: "column",
        };
      case "yAxis":
        return {
          key: field.key,
          value: field.option[0].value,
          type: "column",
        };
      case "columns":
        return {
          key: field.key,
          /** 集計単位を切り替えたときにunitの更新タイミングがずれるため以下のような分岐. area[1].valueとしているのはarea_groupを指定するため */
          value:
            unit === "building"
              ? "area_group,predicted_probability"
              : "normalized_address,reference_date,predicted_probability",
          type: "column",
        };
      case "label":
        return {
          key: field.key,
          value: field.option[0].value,
          type: "column",
        };
      case "value":
        return {
          key: field.key,
          value: field.option[0].value,
          type: "column",
        };
      default:
        return null;
    }
  });

  /** データセットに依存するスタイルごとの設定を追加 */
  (() => {
    switch (style) {
      case "line": {
        parameters = parameters.concat(
          createDefaultLineGroupParameters(referenceDates),
        );
        return;
      }
      case "pie": {
        parameters = parameters.concat(createDefaultPieGroupParameters());
        return;
      }
      default:
        return;
    }
  })();

  const validParameters = parameters.filter((p) => p !== null);

  return validParameters;
};
