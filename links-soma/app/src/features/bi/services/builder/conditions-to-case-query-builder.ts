import { type SQL, sql } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { type GroupCondition } from "../../types/models/parameter";

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

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  const toSqlText = (conditions: GroupCondition[]): string =>
    new SQLiteSyncDialect().sqlToQuery(
      conditionsToCaseQueryBuilder("area_group", conditions),
    ).sql;

  const containsCondition = (label: string): GroupCondition => ({
    key: `group_${label}`,
    type: "group",
    value: {
      label,
      referenceColumnType: "text",
      operation: "contains",
      value: label,
    },
  });

  describe("グループ条件の優先順位", () => {
    /**
     * SQLのCASE式は先頭のWHENから評価し、最初に真になった分岐で確定する。
     * つまり条件配列の順序がそのまま優先順位になり、画面で上にある条件が優先される。
     * 「東町を含む」は「南東町」にも一致するため、この順序が集計結果を決める。
     */
    it("条件配列の順序どおりにWHENを並べる", () => {
      const sqlText = toSqlText([
        containsCondition("東町"),
        containsCondition("南東町"),
      ]);

      expect(sqlText).toContain(
        "when area_group like '%東町%' then '東町' when area_group like '%南東町%' then '南東町'",
      );
    });

    it("条件を逆順で渡すとWHENの並びも逆になる", () => {
      const sqlText = toSqlText([
        containsCondition("南東町"),
        containsCondition("東町"),
      ]);

      expect(sqlText).toContain(
        "when area_group like '%南東町%' then '南東町' when area_group like '%東町%' then '東町'",
      );
    });
  });
}
