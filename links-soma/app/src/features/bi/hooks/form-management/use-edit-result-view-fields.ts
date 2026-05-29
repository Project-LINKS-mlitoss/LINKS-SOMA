import {
  useFieldArray,
  type UseFieldArrayReturn,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { type SelectResultView } from "../../../../db/schema";
import { type EditViewFormType } from "../../types/models/form";
import { useFetchReferenceDates } from "../../../../shared/hooks/use-fetch-reference-dates";
import { TILE_VIEW_CONFIG } from "../../config/tile-view-config";
import { createViewDefaultParameters } from "../../util";

/** リセット時に保持すべきパラメータのキー */
const PRESERVED_PARAMETER_KEYS = ["threshold"] as const;

type Params = {
  dataSetResultId: SelectResultView["data_set_result_id"];
};

export type UseEditResultViewFieldsReturnType = {
  form: UseFormReturn<EditViewFormType>;
  fieldArray: UseFieldArrayReturn<EditViewFormType>;
  handleStyleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  resetParametersByStyle: (style: SelectResultView["style"]) => void;
};

/** @note useFormContextを内部で利用 */
export const useEditResultViewFields = ({
  dataSetResultId,
}: Params): UseEditResultViewFieldsReturnType => {
  const form = useFormContext<EditViewFormType>();
  const { control, setValue, watch } = form;

  const formUnit = watch("unit");

  /** 設定値パラメータを扱うためのフィールドステート */
  const fieldArray = useFieldArray({
    control,
    name: "parameters",
  });

  const { replace } = fieldArray;

  const { data: referenceDates } = useFetchReferenceDates({
    dataSetResultId,
  });

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value as SelectResultView["style"];

    if (!value) return;

    // 種類の値を更新
    setValue("style", value);
    // 集計単位の初期値を設定する
    const unit =
      value === "map-with-table"
        ? "building"
        : TILE_VIEW_CONFIG[value].fields[0].option[0].unit;
    setValue("unit", unit);

    // 現在の閾値パラメータを保持
    const currentParams = watch("parameters") ?? [];
    const preservedParams = currentParams.filter((p) =>
      PRESERVED_PARAMETER_KEYS.includes(
        p.key as (typeof PRESERVED_PARAMETER_KEYS)[number],
      ),
    );

    const newParams = createViewDefaultParameters(
      value,
      formUnit,
      referenceDates,
    );
    setValue("parameters", [...newParams, ...preservedParams]);
  };

  return {
    form,
    fieldArray,
    handleStyleChange,
    resetParametersByStyle: (style) => {
      // 現在の閾値パラメータを保持
      const currentParams = watch("parameters") ?? [];
      const preservedParams = currentParams.filter((p) =>
        PRESERVED_PARAMETER_KEYS.includes(
          p.key as (typeof PRESERVED_PARAMETER_KEYS)[number],
        ),
      );

      const newParams = createViewDefaultParameters(
        style,
        formUnit,
        referenceDates,
      );
      replace([...newParams, ...preservedParams]);
    },
  };
};
