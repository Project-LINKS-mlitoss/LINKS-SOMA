import {
  useFieldArray,
  type UseFieldArrayReturn,
  useForm,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { type SelectResultView } from "../../schema";
import { type EditViewFormType } from "../interfaces/edit-view-form";
import { useFetchReferenceDates } from "../../hooks/use-fetch-reference-dates";
import { TILE_VIEW_CONFIG } from "../../config/tile-view-config";
import { createDefaultLineGroupParameters } from "../util/create-default-line-group-parameters";
import { createDefaultPieGroupParameters } from "../util/create-default-pie-group-parameters";
import { type Parameter } from "../interfaces/parameter";

type Params = {
  dataSetResultId: SelectResultView["data_set_result_id"];
};

type ReturnType = {
  form: UseFormReturn<EditViewFormType>;
  fieldArray: UseFieldArrayReturn<EditViewFormType>;
  handleStyleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  resetParametersByStyle: (style: SelectResultView["style"]) => void;
  formGroupingResultView: UseFormReturn<{ parameters: Parameter[] }>;
};

/** @note useFormContextを内部で利用 */
export const useEditResultViewFields = ({
  dataSetResultId,
}: Params): ReturnType => {
  const form = useFormContext<EditViewFormType>();
  const { control, setValue, watch } = form;
  const fieldArray = useFieldArray({
    control,
    name: "parameters",
  });

  const { replace } = fieldArray;

  const { data: referenceDates } = useFetchReferenceDates({
    dataSetResultId,
  });

  const groupingFields = watch("parameters").filter((field) => {
    return field.type === "group";
  });

  const formGroupingResultView = useForm<{ parameters: Parameter[] }>({
    defaultValues: {
      parameters: groupingFields,
    },
  });

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value as SelectResultView["style"];
    if (!value) return;
    // styleに合わせてparameterをリセット
    const defaultParameters = createResetParametersByStyle(value);
    // 種類の値を更新
    setValue("style", value);
    // 集計単位の初期値を設定する
    const unit =
      value === "map"
        ? "building"
        : TILE_VIEW_CONFIG[value].fields[0].option[0].unit;
    setValue("unit", unit);

    formGroupingResultView.reset({ parameters: [] });

    switch (value) {
      case "line": {
        const parameters = createDefaultLineGroupParameters(referenceDates);
        setValue("parameters", [...defaultParameters, ...parameters]);
        formGroupingResultView.reset({ parameters });
        return;
      }
      case "pie": {
        const parameters = createDefaultPieGroupParameters();
        setValue("parameters", [...defaultParameters, ...parameters]);
        formGroupingResultView.reset({ parameters });
        return;
      }
      default:
        setValue("parameters", defaultParameters);
        return;
    }
  };

  return {
    form,
    fieldArray,
    handleStyleChange,
    resetParametersByStyle: (style) => {
      replace(createResetParametersByStyle(style));
    },
    formGroupingResultView,
  };
};

/** Utility */
const createResetParametersByStyle = (
  style: SelectResultView["style"],
): Parameter[] => {
  if (!style) return [];
  const option = TILE_VIEW_CONFIG[style];
  if (!option) return [];
  const parameters: (Parameter | null)[] = option.fields.map((field) => {
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
          value: field.option[0].value,
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
  return parameters.filter((p) => p !== null);
};
