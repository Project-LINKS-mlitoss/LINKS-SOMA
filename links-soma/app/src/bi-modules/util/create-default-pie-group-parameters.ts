import { type SelectResultView } from "../../schema";

const values: {
  label: string;
  startValue: number;
  lastValue: number;
}[] = [
  {
    label: "空き家推定確率0~25%",
    startValue: 0,
    lastValue: 25,
  },
  {
    label: "空き家推定確率26~50%",
    startValue: 26,
    lastValue: 50,
  },
  {
    label: "空き家推定確率51~75%",
    startValue: 51,
    lastValue: 75,
  },
  {
    label: "空き家推定確率76~100%",
    startValue: 76,
    lastValue: 100,
  },
];

export const createDefaultPieGroupParameters =
  (): SelectResultView["parameters"] => {
    const result: SelectResultView["parameters"] = values.map((value) => ({
      key: `group_${(new Date().getTime() + Math.floor(10000 * Math.random())).toString(16)}` as "group_aggregation",
      value: {
        label: value.label,
        referenceColumnType: "floatRange",
        operation: "range",
        value: 0,
        startValue: value.startValue,
        includesStart: true,
        lastValue: value.lastValue,
        includesLast: true,
      },
      type: "group",
    }));

    const groupingOption = {
      key: "group_aggregation",
      type: "group_aggregation",
      value: "count",
    };

    return [...result, groupingOption] as SelectResultView["parameters"];
  };
