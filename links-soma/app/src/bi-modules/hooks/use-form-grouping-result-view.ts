import {
  useFieldArray,
  useForm,
  useFormContext,
  type UseFieldArrayReturn,
  type UseFormRegister,
} from "react-hook-form";
import { useEffect } from "react";
import { isGroupCondition, type Parameter } from "../interfaces/parameter";
import { type ChartColumnType } from "../../@types/charts";
import { type EditViewFormType } from "../interfaces/edit-view-form";

type UseFormGroupingResultViewParams = {
  onSave: (parameters: Parameter[]) => void;
  columnType: ChartColumnType;
};
export type UseFormGroupingResultViewReturnType = {
  fieldArray: UseFieldArrayReturn<{ parameters: Parameter[] }>;
  formRegister: UseFormRegister<{ parameters: Parameter[] }>;
  handleSave: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleAppend: () => void;
  handleRemove: (index: number) => void;
};

/**
 * グルーピング設定の入力フォームを生成・管理するためのカスタムフック
 */
export const useFormGroupingResultView = ({
  onSave,
  columnType,
}: UseFormGroupingResultViewParams): UseFormGroupingResultViewReturnType => {
  const { control, handleSubmit, register } = useForm<{
    parameters: Parameter[];
  }>({
    defaultValues: {
      parameters: [],
    },
  });

  const fieldArray = useFieldArray({
    control,
    name: "parameters",
  });
  const { append, remove, replace } = fieldArray;

  /** グローバルステートの変更を検知して反映 */
  const form = useFormContext<EditViewFormType>();
  const parameters = form.watch("parameters");
  useEffect(() => {
    const groupingParameters = parameters.filter((parameter) =>
      isGroupCondition(parameter),
    );
    replace(groupingParameters);
  }, [parameters, replace]);

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
    formRegister: register,
    handleSave,
    handleAppend,
    handleRemove,
  };
};

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
