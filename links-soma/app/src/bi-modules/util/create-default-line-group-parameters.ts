import { type ReferenceDate } from "../../ipc-main-listeners/select-reference-dates";
import { type SelectResultView } from "../../schema";
import { formatDate } from "../../utils/format-date";

export const createDefaultLineGroupParameters = (
  referenceDates: ReferenceDate[] | undefined,
): SelectResultView["parameters"] => {
  if (!referenceDates) return [];
  const result: SelectResultView["parameters"] = referenceDates.map((date) => ({
    key: `group_${(new Date().getTime() + Math.floor(10000 * Math.random())).toString(16)}` as "group_aggregation",
    value: {
      label: formatDate(date, "YYYY年"),
      referenceColumnType: "date",
      operation: "eq",
      value: date,
    },
    type: "group",
  }));

  const groupingOption = {
    key: "group_aggregation",
    type: "group_aggregation",
    value: "avg",
  };

  return [...result, groupingOption] as SelectResultView["parameters"];
};
