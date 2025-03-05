import { isFilterCondition, type Parameter } from "../interfaces/parameter";

/**
 * @fixme 本来はグルーピングのフィルターも扱うべき
 */
export const floatToPercent = (parameters: Parameter[]): Parameter[] => {
  return parameters.map((parameter) => {
    if (!isFilterCondition(parameter)) {
      return parameter;
    }
    if (parameter.value.referenceColumnType === "float") {
      return {
        ...parameter,
        value: {
          ...parameter.value,
          value: Number(parameter.value.value * 100),
        },
      };
    }
    if (parameter.value.referenceColumnType === "floatRange") {
      return {
        ...parameter,
        value: {
          ...parameter.value,
          startValue: Number(parameter.value.startValue * 100),
          lastValue: Number(parameter.value.lastValue * 100),
        },
      };
    }
    return parameter;
  });
};
