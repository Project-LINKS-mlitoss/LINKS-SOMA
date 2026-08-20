import { type ReferenceDate } from "../../../ipc-main-listeners/select-reference-dates";
import { type SelectResultView } from "../../../db/schema";
import { formatDate } from "../../../shared/utils/format-date";

export const createDefaultLineGroupParameters = (
  referenceDates: ReferenceDate[] | undefined,
  /** キー接頭辞。指定時は `${keyPrefix}${index}` の決定的キーを使う（プリセット適用など再現性が要る場面用）。 */
  options?: { keyPrefix?: string },
): SelectResultView["parameters"] => {
  if (!referenceDates) return [];
  const result: SelectResultView["parameters"] = referenceDates.map(
    (date, index) => ({
      key: (options?.keyPrefix
        ? `${options.keyPrefix}${index}`
        : `group_${(new Date().getTime() + Math.floor(10000 * Math.random())).toString(16)}`) as "group_aggregation",
      value: {
        label: formatDate(date, "YYYY年"),
        referenceColumnType: "date",
        operation: "eq",
        value: date,
      },
      type: "group",
    }),
  );

  const groupingOption = {
    key: "group_aggregation",
    type: "group_aggregation",
    value: "avg",
  };

  return [...result, groupingOption] as SelectResultView["parameters"];
};
