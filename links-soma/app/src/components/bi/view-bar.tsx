import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Tooltip as ReTooltip,
  Legend as ReLegend,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  Bar as ReBar,
  Cell as ReCell,
  CartesianGrid as ReCartesianGrid,
} from "recharts";
import { useState } from "react";
import { Caption1Strong, tokens } from "@fluentui/react-components";
import { CHART_COLORS } from "../../config/chart-colors";
import { Pagination } from "../ui/pagination";
import { useFetchBarChartProps } from "../../bi-modules/hooks/use-fetch-bar-chart-props";
import { type BarView } from "../../bi-modules/interfaces/view";
import { LoadingChart } from "./loading-chart";

type Props = {
  view: BarView;
};

export const ViewBar = ({ view }: Props): JSX.Element => {
  /** @fixme useFetchが不要回数呼び出されていそう */
  const { chartProps, pagination, isLoading } = useFetchBarChartProps({
    view,
  });

  const xAxis = view.parameters.find((p) => p.key === "xAxis");
  const yAxis = view.parameters.find((p) => p.key === "yAxis");
  const groupingCalc =
    view.parameters.find(
      (p) => p.key === "group_aggregation" && p.type === "group_aggregation",
    )?.value || "avg";

  const isPercentValue =
    groupingCalc === "avg" && chartProps.yAxisColumn.unit === "%";

  const data = chartProps.data.map((d) => ({
    ...d,
    /** 表示のために桁数を調整 */
    y: isPercentValue
      ? Math.floor(d.y * 1000) / 10
      : d.y
        ? Number.parseFloat(d.y.toFixed(1))
        : 0,
  }));

  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeToolTip, setActiveToolTip] = useState<boolean>(false);

  if (isLoading) {
    return <LoadingChart />;
  }

  // カラムが設定されていない場合はエラーを表示
  if (!xAxis || !yAxis) {
    return <div>パラメーターの値を正しく設定してください</div>;
  }

  // フィルタ結果の値が空の場合はエラーを表示
  if (data.length === 0) {
    return (
      <div>
        <Pagination {...pagination} />
        <div>データがありません</div>
      </div>
    );
  }

  return (
    <div>
      <Pagination {...pagination} />
      <ResponsiveContainer height={400} width="100%">
        <ReBarChart
          data={data}
          onMouseLeave={() => {
            setActiveToolTip(false);
          }}
          onMouseMove={(data, _) => {
            if (
              data.activeTooltipIndex === undefined ||
              data.isTooltipActive === undefined
            ) {
              return;
            }
            setActiveIndex(data.activeTooltipIndex);
            setTooltipPosition((prev) => {
              if (data.activeCoordinate === undefined) {
                return prev;
              }

              return {
                x: data.activeCoordinate.x,
                y: prev.y,
              };
            });
            setActiveToolTip(data.isTooltipActive);
          }}
        >
          <ReXAxis dataKey={"x"} unit={chartProps.xAxisColumn.unit} />
          <ReYAxis
            dataKey={"y"}
            unit={groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit}
          />
          <ReTooltip
            active={activeToolTip}
            content={(props) => (
              <div
                style={{
                  background: "#fff",
                  padding: "4px 8px",
                  margin: "2px",
                  border: "1px solid #ccc",
                }}
              >
                {props.payload?.map((item) => (
                  <div key={item.name}>
                    <div>{`${item.payload.x}`}</div>
                    <div
                      style={{ color: tokens.colorBrandStroke1 }}
                    >{`${item.name}: ${item.payload.y}${item.unit}`}</div>
                    <Caption1Strong>
                      {item.payload.reference_date}
                    </Caption1Strong>
                  </div>
                ))}
              </div>
            )}
            cursor={false}
            isAnimationActive={false}
            position={tooltipPosition}
          />
          <ReCartesianGrid vertical={false} />
          <ReLegend />
          <ReBar
            dataKey={"y"}
            fill={CHART_COLORS.primary} // tokensに存在しない値
            name={chartProps.yAxisColumn.label} // Legend（凡例）でも利用される
            onMouseMove={(data, _) => {
              setTooltipPosition((prev) => {
                if (data.tooltipPosition === undefined) {
                  return prev;
                }

                return {
                  x: prev.x,
                  y: data.y,
                };
              });
            }}
            unit={groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit}
          >
            {data.map((_, index) => (
              <ReCell
                key={`cell-${index}`}
                cursor="pointer"
                fill={
                  index === activeIndex && activeToolTip
                    ? CHART_COLORS.teritiary
                    : CHART_COLORS.primary
                }
              />
            ))}
          </ReBar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
};
