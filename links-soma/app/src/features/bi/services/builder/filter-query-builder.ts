import { type SQL, sql } from "drizzle-orm";
import { type FilterCondition } from "../../types/models/parameter";
import {
  resolveColumnWithThreshold,
  type ThresholdValue,
} from "../../util/threshold-column-utils";

export const filterQueryBuilder = (params: {
  conditions: FilterCondition[];
  threshold?: ThresholdValue;
  unit?: "building" | "area";
}): SQL<unknown>[] => {
  const { threshold, unit } = params;

  /**
   * 閾値に基づいてフィルター対象カラム名を解決
   * 閾値が設定されている場合、対象カラムを閾値別カラムに置き換える
   */
  const resolveColumn = (column: string): string => {
    if (threshold === undefined || unit === undefined) {
      return column;
    }
    return resolveColumnWithThreshold(column, threshold, unit);
  };

  const conditionValues = params.conditions.map((condition) => condition.value);
  return conditionValues.map((condition) => {
    // 閾値に基づいてカラム名を解決
    const referenceColumn = resolveColumn(condition.referenceColumn);
    if (condition.referenceColumnType === "text") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${referenceColumn} = '${condition.value}'`);
        case "noteq":
          return sql.raw(`${referenceColumn} != '${condition.value}'`);
        case "contains":
          return sql.raw(`${referenceColumn} LIKE '%${condition.value}%'`);
        case "notContains":
          return sql.raw(`${referenceColumn} NOT LIKE '%${condition.value}%'`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "integer") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${referenceColumn} = ${condition.value}`);
        case "noteq":
          return sql.raw(`${referenceColumn} != ${condition.value}`);
        case "gt":
          return sql.raw(`${referenceColumn} > ${condition.value}`);
        case "gte":
          return sql.raw(`${referenceColumn} >= ${condition.value}`);
        case "lt":
          return sql.raw(`${referenceColumn} < ${condition.value}`);
        case "lte":
          return sql.raw(`${referenceColumn} <= ${condition.value}`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "integerRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${referenceColumn} ${condition.includesStart ? ">=" : ">"} ${condition.startValue} AND ${referenceColumn} ${condition.includesLast ? "<=" : "<"} ${condition.lastValue}`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "float") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${referenceColumn} = ${condition.value}`);
        case "noteq":
          return sql.raw(`${referenceColumn} != ${condition.value}`);
        case "gt":
          return sql.raw(`${referenceColumn} > ${condition.value}`);
        case "gte":
          return sql.raw(`${referenceColumn} >= ${condition.value}`);
        case "lt":
          return sql.raw(`${referenceColumn} < ${condition.value}`);
        case "lte":
          return sql.raw(`${referenceColumn} <= ${condition.value}`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "floatRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${referenceColumn} ${condition.includesStart ? ">=" : ">"} ${condition.startValue} AND ${referenceColumn} ${condition.includesLast ? "<=" : "<"} ${condition.lastValue}`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "date") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${referenceColumn} = '${condition.value}'`);
        case "noteq":
          return sql.raw(`${referenceColumn} != '${condition.value}'`);
        case "gt":
          return sql.raw(`${referenceColumn} > '${condition.value}'`);
        case "gte":
          return sql.raw(`${referenceColumn} >= '${condition.value}'`);
        case "lt":
          return sql.raw(`${referenceColumn} < '${condition.value}'`);
        case "lte":
          return sql.raw(`${referenceColumn} <= '${condition.value}'`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "dateRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${referenceColumn} ${condition.includesStart ? ">=" : ">"} '${condition.startValue}' AND ${referenceColumn} ${condition.includesLast ? "<=" : "<"} '${condition.lastValue}'`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "boolean") {
      switch (condition.operation) {
        case "isTrue":
          return sql.raw(`${referenceColumn} = 1`);
        case "isFalse":
          return sql.raw(`${referenceColumn} = 0`);
        default:
          return sql.raw(``);
      }
    }

    return sql.raw(``);
  });
};
