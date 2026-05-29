import {
  ArrowSortDownRegular,
  ArrowSortUpRegular,
} from "@fluentui/react-icons";
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
import { forwardRef, useState, useImperativeHandle } from "react";
import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { CHART_COLORS } from "../../../../../shared/config/chart-colors";
import { type BarView } from "../../../types/models/view";
import { type ChartExportHandle } from "../../../types/chart-export";
import { AREA_DATASET_COLUMN_METADATA } from "../../../../../shared/config/column-metadata";
import { useFetchBarChartProps } from "../../../hooks";
import { Button, Pagination } from "../../../../../shared/components/ui";
import {
  QueryHeader,
  QueryHeaderWithPagination,
  QueryHeaderWrapper,
} from "../../shared/query-header";
import { useChartCsvExport } from "../../../hooks/use-chart-csv-export";
import { LoadingChart } from "./loading-chart";

const useStyles = makeStyles({
  positionContainer: {
    position: "relative",
    height: "400px",
  },
  buttonContainer: {
    position: "absolute",
    top: `${400 - 26}px`,
    left: "22px",
    display: "flex",
    gap: "4px",
  },
});

type Props = {
  view: BarView;
};

export const ViewBar = forwardRef<ChartExportHandle, Props>(({ view }, ref) => {
  const styles = useStyles();

  const {
    chartProps,
    pagination,
    isLoading,
    useOrderBy: {
      handleColumnChange,
      orderBy: { column, direction },
    },
  } = useFetchBarChartProps({
    view,
  });

  const OrderByIcon = (() => {
    if (column !== "area_group") return null;
    return direction === "ascending" ? (
      <ArrowSortUpRegular
        color={tokens.colorNeutralForeground1}
        fontSize={11}
        strokeWidth={2}
      />
    ) : (
      <ArrowSortDownRegular
        color={tokens.colorNeutralForeground1}
        fontSize={11}
        strokeWidth={2}
      />
    );
  })();

  const hasGroupConditions = view.parameters.some((p) => p.type === "group");

  const xAxis = view.parameters.find((p) => p.key === "xAxis");
  const yAxis = view.parameters.find((p) => p.key === "yAxis");
  const groupingCalc =
    view.parameters.find(
      (p) => p.key === "group_aggregation" && p.type === "group_aggregation",
    )?.value || "avg";

  const yAxisMinMaxParam = view.parameters.find(
    (p) => p.key === "yAxisMinMax" && p.type === "yAxisMinMax",
  )?.value || { min: null, max: null };
  const yAxisMax =
    yAxisMinMaxParam.max !== null && yAxisMinMaxParam.max !== undefined
      ? Number(yAxisMinMaxParam.max)
      : null;

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

  // カラムが設定されていない場合はエラーを表示
  if (!xAxis || !yAxis) {
    return <div>パラメーターの値を正しく設定してください</div>;
  }

  // フィルタ結果の値が空の場合はエラーを表示
  if (data.length === 0) {
    return (
      <div>
        {!hasGroupConditions && <Pagination {...pagination} />}
        <div>データがありません</div>
      </div>
    );
  }

  return (
    <div>
      <QueryHeaderWrapper>
        {hasGroupConditions ? (
          <QueryHeader
            allCount={chartProps.allCount}
            filteredCount={data.length}
          />
        ) : (
          <>
            <QueryHeaderWithPagination
              allCount={chartProps.allCount}
              currentDataLength={data.length}
              pagination={pagination}
            />
            <Pagination {...pagination} />
          </>
        )}
      </QueryHeaderWrapper>
      <div className={styles.positionContainer}>
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
              allowDataOverflow={yAxisMax !== null}
              dataKey={"y"}
              domain={[0, yAxisMax !== null ? yAxisMax : "dataMax"]}
              unit={
                groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit
              }
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
              unit={
                groupingCalc === "count" ? "件" : chartProps.yAxisColumn.unit
              }
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
        <div className={styles.buttonContainer}>
          <Button
            onClick={() => {
              handleColumnChange("area_group");
            }}
            size="small"
            style={{
              fontWeight: "normal",
            }}
          >
            {AREA_DATASET_COLUMN_METADATA["area_group"].label}
            {OrderByIcon}
          </Button>
          {column !== "reference_date" && (
            <Button
              appearance="transparent"
              onClick={() => handleColumnChange("reference_date")}
              size="small"
            >
              解除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

ViewBar.displayName = "ViewBar";
