import {
  useFieldArray,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from "react-hook-form";
import { type Parameter } from "../interfaces/parameter";
import { type ChartColumnType } from "../../@types/charts";

type UseFormGroupingResultViewParams = {
  formGroupingResultView: UseFormReturn<{ parameters: Parameter[] }>;
  parameters: Parameter[];
  onSave: (parameters: Parameter[]) => void;
  columnType: ChartColumnType;
};
export type UseFormGroupingResultViewReturnType = {
  fieldArray: UseFieldArrayReturn<{ parameters: Parameter[] }>;
  parameterFilters: Parameter[];
  handleSave: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleAppend: () => void;
  handleRemove: (index: number) => void;
};

/**
 * グルーピング設定の入力フォームを生成・管理するためのカスタムフック
 */
export const useFormGroupingResultView = ({
  formGroupingResultView,
  onSave,
  columnType,
}: UseFormGroupingResultViewParams): UseFormGroupingResultViewReturnType => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 複雑な型情報をあえて削除
  const defaultCondition = (columnType: ChartColumnType) => {
    switch (columnType) {
      case "boolean":
        return {
          label: "",
          referenceColumnType: "boolean",
          operation: "isTrue",
        } as const;
      case "text":
        return {
          label: "",
          referenceColumnType: "text",
          operation: "eq",
          value: "",
        } as const;
      case "date":
        return {
          label: "",
          referenceColumnType: "date",
          operation: "eq",
          value: "",
        } as const;
      case "float":
        return {
          label: "",
          referenceColumnType: "float",
          operation: "eq",
          value: 0,
        } as const;
      default:
        return {
          label: "",
          referenceColumnType: "integer",
          operation: "eq",
          value: 0,
        } as const;
    }
  };

  const { control, handleSubmit, watch } = formGroupingResultView;

  const fieldArray = useFieldArray({
    control,
    name: "parameters",
  });
  const { append, remove } = fieldArray;

  const parameterFilters = watch("parameters");

  const handleSave = handleSubmit((data) => {
    onSave(data.parameters);
  });

  const handleAppend = (): void => {
    append({
      key: `group_${(new Date().getTime() + Math.floor(10000 * Math.random())).toString(16)}`,
      value: defaultCondition(columnType),
      type: "group",
    });
  };

  const handleRemove = (index: number): void => {
    remove(index);
  };

  return {
    fieldArray,
    parameterFilters,
    handleSave,
    handleAppend,
    handleRemove,
  };
};
