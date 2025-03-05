import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  Tooltip as ReTooltip,
  Line as ReLine,
  Legend as ReLegend,
  CartesianGrid as ReCartesianGrid,
  type DotProps,
} from "recharts";
import {
  tokens,
  Tooltip as FUIToolTip,
  makeStyles,
} from "@fluentui/react-components";
import { CHART_COLORS } from "../../config/chart-colors";
import { type LineView } from "../../bi-modules/interfaces/view";
import { useFetchLineChartProps } from "../../bi-modules/hooks/use-fetch-line-chart-props";
import { LoadingChart } from "./loading-chart";

const CustomizedDot = ({
  cx,
  cy,
  stroke,
}: {
  cx: number;
  cy: number;
  stroke: string;
}): JSX.Element => {
  return (
    <svg
      fill={stroke}
      height={8}
      viewBox="0 0 8 8"
      width={8}
      x={cx - 4}
      y={cy - 4}
    >
      <circle
        cx={4}
        cy={4}
        fill={tokens.colorNeutralBackground1}
        r={3}
        stroke={stroke}
        strokeWidth={2}
      />
    </svg>
  );
};

const useStyles = makeStyles({
  tooltip: {
    backgroundColor: tokens.colorNeutralForeground2,
    color: tokens.colorNeutralForegroundInverted,
    fontSize: tokens.fontSizeBase200,
    padding: `5px ${tokens.spacingHorizontalM}`, //tokensに存在しない値
    boxShadow: tokens.shadow8,
    borderRadius: "3px", // tokensに存在しない値
  },
});

const CustomizedActiveDot = ({
  cx,
  cy,
  stroke,
  value,
  unit,
}: DotProps & {
  value?: number;
  unit?: string;
}): JSX.Element => {
  const styles = useStyles();

  const labelText = unit ? `${value}${unit}` : value;

  if (cx == null || cy == null) {
    return <></>;
  }

  return (
    <FUIToolTip
      content={{
        children: labelText,
        className: styles.tooltip,
      }}
      positioning={"above"}
      relationship="label"
      visible
      withArrow
    >
      <svg
        fill={stroke}
        height={8}
        viewBox="0 0 8 8"
        width={8}
        x={cx - 4}
        y={cy - 4}
      >
        <circle
          cx={4}
          cy={4}
          fill={CHART_COLORS.primary}
          r={3}
          stroke={CHART_COLORS.teritiary}
          strokeWidth={2}
        />
      </svg>
    </FUIToolTip>
  );
};

type Props = {
  view: LineView;
};

export const ViewLine = ({ view }: Props): JSX.Element => {
  const { chartProps, isLoading } = useFetchLineChartProps({ view });

  const xAxis = view.parameters.find((p) => p.key === "xAxis");
  const yAxis = view.parameters.find((p) => p.key === "yAxis");
  const groupingCalc =
    view.parameters.find(
      (p) => p.key === "group_aggregation" && p.type === "group_aggregation",
    )?.value || "avg";

  const isPercentValue =
    groupingCalc === "avg" && chartProps.yAxisColumn.unit === "%";

  const data = chartProps.data.map((d) => {
    return {
      ...d,
      y: isPercentValue
        ? Math.floor(d.y * 1000) / 10
        : Number.parseFloat(d.y.toFixed(1)), // floatな値を扱うことがあるため、桁が溢れないように小数点第一位まで表示する
    };
  });

  if (isLoading) {
    return <LoadingChart />;
  }

  if (!xAxis || !yAxis) {
    return <div>パラメーターの値を正しく設定してください</div>;
  }

  if (data.length === 0) {
    return <div>データがありません</div>;
  }

  return (
    <ResponsiveContainer height={400} width="100%">
      <ReLineChart data={data}>
        <ReXAxis dataKey={"x"} unit={chartProps.xAxisColumn.unit} />
        <ReYAxis
          dataKey={"y"}
          unit={groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit}
        />
        <ReTooltip
          wrapperStyle={{
            display: "none",
          }}
        />
        <ReCartesianGrid vertical={false} />
        <ReLine
          activeDot={
            <CustomizedActiveDot
              unit={
                groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit
              }
            />
          }
          dataKey={"y"}
          // @ts-expect-error 内部処理で適切なPropsが渡されるが型定義が不足しているためエラーが出る
          dot={<CustomizedDot />}
          name={chartProps.yAxisColumn.label}
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          unit={groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit}
        />
        <ReLegend />
      </ReLineChart>
    </ResponsiveContainer>
  );
};
