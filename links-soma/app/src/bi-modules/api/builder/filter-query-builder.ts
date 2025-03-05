import { type SQL, sql } from "drizzle-orm";
import { type FilterCondition } from "../../interfaces/parameter";

export const filterQueryBuilder = (params: {
  conditions: FilterCondition[];
}): SQL<unknown>[] => {
  const conditionValues = params.conditions.map((condition) => condition.value);
  return conditionValues.map((condition) => {
    if (condition.referenceColumnType === "text") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${condition.referenceColumn} = '${condition.value}'`);
        case "noteq":
          return sql.raw(
            `${condition.referenceColumn} != '${condition.value}'`,
          );
        case "contains":
          return sql.raw(
            `${condition.referenceColumn} LIKE '%${condition.value}%'`,
          );
        case "notContains":
          return sql.raw(
            `${condition.referenceColumn} NOT LIKE '%${condition.value}%'`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "integer") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${condition.referenceColumn} = ${condition.value}`);
        case "noteq":
          return sql.raw(`${condition.referenceColumn} != ${condition.value}`);
        case "gt":
          return sql.raw(`${condition.referenceColumn} > ${condition.value}`);
        case "gte":
          return sql.raw(`${condition.referenceColumn} >= ${condition.value}`);
        case "lt":
          return sql.raw(`${condition.referenceColumn} < ${condition.value}`);
        case "lte":
          return sql.raw(`${condition.referenceColumn} <= ${condition.value}`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "integerRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${condition.referenceColumn} ${condition.includesStart ? ">=" : ">"} ${condition.startValue} AND ${condition.referenceColumn} ${condition.includesLast ? "<=" : "<"} ${condition.lastValue}`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "float") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${condition.referenceColumn} = ${condition.value}`);
        case "noteq":
          return sql.raw(`${condition.referenceColumn} != ${condition.value}`);
        case "gt":
          return sql.raw(`${condition.referenceColumn} > ${condition.value}`);
        case "gte":
          return sql.raw(`${condition.referenceColumn} >= ${condition.value}`);
        case "lt":
          return sql.raw(`${condition.referenceColumn} < ${condition.value}`);
        case "lte":
          return sql.raw(`${condition.referenceColumn} <= ${condition.value}`);
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "floatRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${condition.referenceColumn} ${condition.includesStart ? ">=" : ">"} ${condition.startValue} AND ${condition.referenceColumn} ${condition.includesLast ? "<=" : "<"} ${condition.lastValue}`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "date") {
      switch (condition.operation) {
        case "eq":
          return sql.raw(`${condition.referenceColumn} = '${condition.value}'`);
        case "noteq":
          return sql.raw(
            `${condition.referenceColumn} != '${condition.value}'`,
          );
        case "gt":
          return sql.raw(`${condition.referenceColumn} > '${condition.value}'`);
        case "gte":
          return sql.raw(
            `${condition.referenceColumn} >= '${condition.value}'`,
          );
        case "lt":
          return sql.raw(`${condition.referenceColumn} < '${condition.value}'`);
        case "lte":
          return sql.raw(
            `${condition.referenceColumn} <= '${condition.value}'`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "dateRange") {
      switch (condition.operation) {
        case "range":
          return sql.raw(
            `${condition.referenceColumn} ${condition.includesStart ? ">=" : ">"} '${condition.startValue}' AND ${condition.referenceColumn} ${condition.includesLast ? "<=" : "<"} '${condition.lastValue}'`,
          );
        default:
          return sql.raw(``);
      }
    } else if (condition.referenceColumnType === "boolean") {
      switch (condition.operation) {
        case "isTrue":
          return sql.raw(`${condition.referenceColumn} = 1`);
        case "isFalse":
          return sql.raw(`${condition.referenceColumn} = 0`);
        default:
          return sql.raw(``);
      }
    }

    return sql.raw(``);
  });
};
