import { useCallback, useState } from "react";
import { type ChartProps as ChartPropsBase } from "../types";

type ChartProps =
  | ChartPropsBase
  | {
      data: { x: string; y: number }[];
      xAxisColumn: { type: "string" };
      yAxisColumn: { type: "number" };
      totalCount: number;
      allCount: number;
    };

type ReturnType = {
  chartProps: ChartProps;
  handleChartProps: (chartProps: ChartProps) => void;
};

export const useChartProps = (): ReturnType => {
  const [chartProps, setChartProps] = useState<ChartProps>({
    data: [],
    xAxisColumn: { type: "string" },
    yAxisColumn: { type: "number" },
    totalCount: 0,
    allCount: 0,
  });

  const handleChartProps = useCallback((chartProps: ChartProps): void => {
    setChartProps(chartProps);
  }, []);

  return {
    chartProps,
    handleChartProps,
  };
};
