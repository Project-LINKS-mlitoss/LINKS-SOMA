// 開発用のコードで本番環境で利用しない可能性があるため、仮で作成

import { type ChartProps } from "../@types/charts";
import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../schema";

type ResultToChartArg =
  | {
      type: "buildings";
      data: SelectDataSetDetailBuilding[];
      xAxis: keyof SelectDataSetDetailBuilding;
      yAxis: keyof SelectDataSetDetailBuilding;
    }
  | {
      type: "areas";
      data: SelectDataSetDetailArea[];
      xAxis: keyof SelectDataSetDetailArea;
      yAxis: keyof SelectDataSetDetailArea;
    };

export const resultToChartProps = (
  prop: ResultToChartArg,
): ChartProps | undefined => {
  if (prop.type === "buildings") {
    return {
      data: prop.data.map((item) => ({
        x: item[prop.xAxis] ?? "",
        y: item[prop.yAxis] as number,
      })),
      xAxisColumn: {
        type: "string",
      },
      yAxisColumn: {
        type: "number",
      },
    };
  }

  if (prop.type === "areas") {
    return {
      data: prop.data.map((item) => ({
        x: item[prop.xAxis] ?? "",
        y: item[prop.yAxis] as number,
      })),
      xAxisColumn: {
        type: "string",
      },
      yAxisColumn: {
        type: "number",
      },
    };
  }

  return;
};
