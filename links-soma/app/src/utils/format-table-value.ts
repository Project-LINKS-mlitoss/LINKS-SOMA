import { type ChartColumnType } from "../@types/charts";

export const formatTableValue = (
  value: number | string | null,
  metadata?: {
    unit?: string;
    percentage?: boolean;
    type: ChartColumnType;
  } | null,
  digits = 2,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 型推論を利用するため
) => {
  if (value === null) {
    return "";
  }

  if (typeof value !== "number") {
    return value;
  }

  if (typeof value === "number" && metadata?.type === "boolean") {
    return value === 1 ? "○" : "×";
  }

  if (typeof value === "number" && metadata?.unit === "%") {
    return Math.floor(value * 1000) / 10;
  }

  return Number(value.toFixed(digits));
};
