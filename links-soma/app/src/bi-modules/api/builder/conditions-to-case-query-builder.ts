import { type SQL, sql } from "drizzle-orm";
import { type GroupCondition } from "../../interfaces/parameter";

const operationToQuery = (
  operation: GroupCondition["value"]["operation"],
): string => {
  switch (operation) {
    case "eq":
      return "=";
    case "noteq":
      return "<>";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "gte":
      return ">=";
    case "lte":
      return "<=";
    case "contains":
      return "like";
    case "notContains":
      return "not like";
    default:
      return "";
  }
};

/** key: 項目とconditionsからグループ名(condition.velue)を付与するクエリを生成 */
export const conditionsToCaseQueryBuilder = (
  key: string,
  conditions: GroupCondition[],
): SQL => {
  const conditionSQL: SQL[] = conditions.map(({ value: condition }) => {
    if (condition.operation === "range") {
      if (
        condition.startValue === undefined &&
        condition.lastValue === undefined
      ) {
        return sql.raw("");
      }

      const startValue = condition.startValue;
      const lastValue = condition.lastValue;
      const includesStart = condition.includesStart;
      const includesLast = condition.includesLast;

      // 開始値の条件クエリを作成
      const startQuery =
        condition.referenceColumnType === "dateRange" // 日付の場合は文字列としての比較が必要なため
          ? `${key} ${includesStart === true ? ">=" : ">"} '${startValue}'`
          : `${key} ${includesStart === true ? ">=" : ">"} ${startValue}`;
      // 終了値の条件クエリを作成
      const lastQuery =
        condition.referenceColumnType === "dateRange" // 日付の場合は文字列としての比較が必要なため
          ? `${key} ${includesLast === true ? "<=" : "<"} '${lastValue}'`
          : `${key} ${includesLast === true ? "<=" : "<"} ${lastValue}`;

      return sql.raw(
        `when ${startQuery} and ${lastQuery} then '${condition.label}'`,
      );
    }

    const value =
      typeof condition.value === "number"
        ? condition.value
        : `'${condition.operation === "contains" || condition.operation === "notContains" ? `%${condition.value}%` : condition.value}'`;

    return sql.raw(
      `when ${key} ${operationToQuery(condition.operation)} ${value} then '${condition.label}'`,
    );
  });

  return sql`*, case ${sql.join(conditionSQL, sql.raw(" "))} end`;
};
