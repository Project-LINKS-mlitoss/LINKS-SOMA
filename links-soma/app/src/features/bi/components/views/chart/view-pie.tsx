import {
  PieChart as RePieChart,
  Legend as ReLegend,
  Pie as RePie,
  Cell as ReCell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  type TooltipProps,
} from "recharts";
import {
  type NameType,
  type ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { forwardRef, useImperativeHandle } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { CHART_COLORS } from "../../../../../shared/config/chart-colors";
import { type PieView } from "../../../types/models/view";
import { type ChartExportHandle } from "../../../types/chart-export";
import { useFetchPieChartProps } from "../../../hooks";
import { QueryHeader, QueryHeaderWrapper } from "../../shared/query-header";
import { useChartCsvExport } from "../../../hooks/use-chart-csv-export";
import { LoadingChart } from "./loading-chart";

const useStyle = makeStyles({
  tooltip: {
    backgroundColor: tokens.colorNeutralForeground2,
    color: tokens.colorNeutralForegroundInverted,
    fontSize: tokens.fontSizeBase200,
    padding: `5px ${tokens.spacingHorizontalM}`, //tokensに存在しない値
    boxShadow: tokens.shadow8,
    borderRadius: "3px", // tokensに存在しない値
  },
});

type Props = {
  view: PieView;
};

export const ViewPie = forwardRef<ChartExportHandle, Props>(({ view }, ref) => {
  const { chartProps, isLoading } = useFetchPieChartProps({ view });

  const label = view.parameters.find((p) => p.key === "label");
  const value = view.parameters.find((p) => p.key === "value");

  const groupAggregation = view.parameters.find(
    (p) => p.type === "group_aggregation",
  );

  const isPercentValue =
    groupAggregation?.value === "avg" && chartProps.yAxisColumn.unit === "%";
  const data = chartProps.data.map((d) => ({
    ...d,
    y: isPercentValue
      ? Math.floor(d.y * 1000) / 10
      : Number.parseFloat(d.y.toFixed(1)), // floatな値を扱うことがあるため、桁が溢れないように小数点第一位まで表示する
  }));

  const { handleChartCsvExport } = useChartCsvExport({
    view,
    exportChartProps: {
      data,
      xAxisColumn: {
        label: chartProps.xAxisColumn.label || "X軸",
        unit: chartProps.xAxisColumn.unit,
      },
      yAxisColumn: {
        label: chartProps.yAxisColumn.label || "Y軸",
        unit: chartProps.yAxisColumn.unit,
      },
      allCount: chartProps.allCount,
      totalCount: chartProps.totalCount,
    },
  });

  // refでエクスポート関数を公開
  useImperativeHandle(
    ref,
    () => ({
      exportCsv: handleChartCsvExport,
    }),
    [handleChartCsvExport],
  );

  if (isLoading) {
    return <LoadingChart />;
  }

  if (!label || !value) {
    return <div>パラメーターの値を正しく設定してください</div>;
  }

  if (data.length === 0) {
    return <div>データがありません</div>;
  }

  /**
   * TooltipPropsに渡す２つの型は、ベースのTooltipPropsが必要とする型で最低限のものを渡している
   */
  type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
    unit?: string;
  };

  const CustomTooltip = (props: CustomTooltipProps): JSX.Element | null => {
    const active = props.active;
    const payload = props.payload;

    const styles = useStyle();

    if (active && payload && payload.length) {
      const label = payload[0].payload["x"];
      const value = payload[0].value;

      return (
        <div className={styles.tooltip}>
          <p className="desc">
            {label}: {value}
            {props.unit ?? ""}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <QueryHeaderWrapper>
        <QueryHeader
          allCount={chartProps.allCount}
          filteredCount={chartProps.totalCount}
        />
      </QueryHeaderWrapper>
      <ResponsiveContainer height={400} width="100%">
        <RePieChart height={400} width={400}>
          <ReTooltip
            content={
              <CustomTooltip
                unit={
                  groupAggregation?.value === "count"
                    ? "件"
                    : chartProps.yAxisColumn.unit
                }
              />
            }
          />
          <RePie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="y"
            endAngle={-270}
            labelLine={false}
            nameKey={"x"}
            startAngle={90}
          >
            {data.map((_, index) => {
              return (
                <ReCell
                  key={index}
                  fill={
                    CHART_COLORS.repeated[index % CHART_COLORS.repeated.length]
                  }
                />
              );
            })}
          </RePie>
          <ReLegend align="right" layout="vertical" verticalAlign="middle" />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
});

ViewPie.displayName = "ViewPie";
