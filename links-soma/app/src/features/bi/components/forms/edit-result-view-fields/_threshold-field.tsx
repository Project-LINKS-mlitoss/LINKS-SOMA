import { useFormContext } from "react-hook-form";
import {
  Field,
  Fieldset,
  FieldLegend,
  Select,
} from "../../../../../shared/components/ui";
import { THRESHOLD_VALUES } from "../../../types/schema/parameter";
import { useFetchEstimationThreshold } from "../../../hooks";
import type { SelectResultView } from "../../../../../db/schema";
import type { EditViewFormType } from "../../../types/models/form";
import type { Threshold } from "../../../types/models/parameter";

type Props = {
  dataSetResultId: SelectResultView["data_set_result_id"];
};

/**
 * 閾値選択フィールド
 * 空き家判定の閾値（5%〜100%）を選択するドロップダウン
 */
export const ThresholdField = ({ dataSetResultId }: Props): JSX.Element => {
  const { watch, setValue } = useFormContext<EditViewFormType>();
  const parameters = watch("parameters");

  // 推定実行時に使用された閾値を取得
  const { data: estimationThreshold } = useFetchEstimationThreshold({
    dataSetResultId,
  });

  // 現在の閾値パラメータを取得
  const currentThreshold = parameters?.find(
    (p): p is Threshold => p.key === "threshold",
  );

  const handleThresholdChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const newValue = e.target.value;
    const existingParams = parameters ?? [];

    if (newValue === "") {
      // 「設定なし」が選択された場合、閾値パラメータを削除
      setValue(
        "parameters",
        existingParams.filter((p) => p.key !== "threshold"),
        { shouldDirty: true },
      );
    } else {
      // 閾値が選択された場合、パラメータを更新または追加
      const thresholdParam: Threshold = {
        key: "threshold",
        type: "threshold",
        value: newValue as Threshold["value"],
      };

      const existingIndex = existingParams.findIndex(
        (p) => p.key === "threshold",
      );
      if (existingIndex >= 0) {
        const newParams = [...existingParams];
        newParams[existingIndex] = thresholdParam;
        setValue("parameters", newParams, { shouldDirty: true });
      } else {
        setValue("parameters", [...existingParams, thresholdParam], {
          shouldDirty: true,
        });
      }
    }
  };

  return (
    <Fieldset>
      <FieldLegend>判定設定</FieldLegend>
      <Field label="空き家判定閾値">
        <Select
          onChange={handleThresholdChange}
          value={currentThreshold?.value ?? ""}
        >
          <option value="">
            {estimationThreshold != null
              ? `${Math.round(estimationThreshold * 100)}%（デフォルト）`
              : "設定なし（デフォルト）"}
          </option>
          {THRESHOLD_VALUES.map((threshold) => (
            <option key={threshold} value={threshold.toString()}>
              {threshold}%
            </option>
          ))}
        </Select>
      </Field>
    </Fieldset>
  );
};
