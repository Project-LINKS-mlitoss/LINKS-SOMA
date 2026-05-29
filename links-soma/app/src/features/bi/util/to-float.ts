import { isFilterCondition, type Parameter } from "../types/models/parameter";

/**
 * グルーピング条件のfloat変換は呼び出し側（chart API）で個別対応している
 */
export const toFloat = (parameters: Parameter[]): Parameter[] => {
  return parameters.map((parameter) => {
    if (!isFilterCondition(parameter)) return parameter;
    if (parameter.value.referenceColumnType === "float") {
      return {
        ...parameter,
        value: {
          ...parameter.value,
          value: Number(parameter.value.value / 100),
        },
      };
    }
    if (parameter.value.referenceColumnType === "floatRange") {
      return {
        ...parameter,
        value: {
          ...parameter.value,
          startValue: Number(parameter.value.startValue / 100),
          lastValue: Number(parameter.value.lastValue / 100),
        },
      };
    }
    return parameter;
  });
};
