import {
  Card,
  makeStyles,
  mergeClasses,
  tokens,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Text,
  typographyStyles,
} from "@fluentui/react-components";
import { type PreprocessSummaryTaskResult } from "../../../../../shared/types/job-task-result";
import { lang } from "../../../../../shared/config/lang";
import { formatBreakdownPercent } from "../../../util/preprocess-summary-rows";

const s = lang.components.preprocessSummary;

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalL,
  },
  card: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
  },
  sectionTitle: {
    ...typographyStyles.subtitle2,
    marginBottom: tokens.spacingVerticalM,
  },
  sectionTitleWithMargin: {
    ...typographyStyles.subtitle2,
    marginBottom: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalXXL,
  },
  totalCount: {
    ...typographyStyles.title3,
  },
  totalCountLabel: {
    ...typographyStyles.body1,
    color: tokens.colorNeutralForeground2,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  tableCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
  },
  statusText: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  hasData: {
    color: "#09583B",
  },
  noData: {
    color: tokens.colorNeutralForeground3,
  },
});

type Props = {
  data: PreprocessSummaryTaskResult;
};

export function PreprocessSummaryView({ data }: Props): JSX.Element {
  const styles = useStyles();

  // 構成比の書式は検証情報DLと共有する。画面とファイルで数値の形が食い違わないため
  const formatPercentage = formatBreakdownPercent;

  const renderStatusText = (hasData: boolean): JSX.Element => {
    return (
      <Text
        className={mergeClasses(
          styles.statusText,
          hasData ? styles.hasData : styles.noData,
        )}
      >
        {hasData ? s.hasData : s.noData}
      </Text>
    );
  };

  return (
    <div className={styles.container}>
      {/* 総件数 */}
      <Card className={styles.card}>
        <Text className={styles.sectionTitle}>{s.totalCountSection}</Text>
        <div>
          <Text className={styles.totalCountLabel}>{s.totalCountLabel}</Text>
          <br />
          <Text className={styles.totalCount}>
            {data.estimation_target_total_count.toLocaleString()}件
          </Text>
        </div>
      </Card>

      <Text className={styles.sectionTitleWithMargin}>
        {s.breakdownHeading}
      </Text>

      {/* 名寄せ処理済データの内訳 */}
      <Card className={styles.card}>
        {/* レコードの組み合わせ別 */}
        <Text className={styles.sectionTitle}>
          {s.recordCombinationSection}
        </Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                {s.waterSupplyColumn}
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                {s.jukiRegistryColumn}
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                {s.toukiRegistryColumn}
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                {s.percentageColumn}
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.record_combinations.map((item, index) => (
              <TableRow key={index}>
                <TableCell className={styles.tableCell}>
                  {renderStatusText(item.has_water_supply)}
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {renderStatusText(item.has_juki_registry)}
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {renderStatusText(item.has_touki_registry)}
                </TableCell>
                <TableCell className={styles.tableCell}>
                  {formatPercentage(
                    item.percentage,
                    item.count,
                    data.record_combinations_total,
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* 家屋種別 */}
      <Card className={styles.card}>
        <Text className={styles.sectionTitle}>{s.buildingTypeSection}</Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                {s.typeColumn}
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                {s.percentageColumn}
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className={styles.tableCell}>
                {s.buildingTypeUserSpecified}
              </TableCell>
              <TableCell className={styles.tableCell}>
                {formatPercentage(
                  data.building_type_breakdown?.user_specified?.percentage ?? 0,
                  data.building_type_breakdown?.user_specified?.count ?? 0,
                  data.building_type_breakdown_total,
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className={styles.tableCell}>
                {s.buildingTypeUnknown}
              </TableCell>
              <TableCell className={styles.tableCell}>
                {formatPercentage(
                  data.building_type_breakdown?.unknown?.percentage ?? 0,
                  data.building_type_breakdown?.unknown?.count ?? 0,
                  data.building_type_breakdown_total,
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* 地図表示別 */}
      <Card className={styles.card}>
        <Text className={styles.sectionTitle}>{s.mapDisplaySection}</Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                {s.typeColumn}
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                {s.percentageColumn}
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className={styles.tableCell}>
                {s.mapDisplayWithPolygon}
              </TableCell>
              <TableCell className={styles.tableCell}>
                {formatPercentage(
                  data.building_polygon_breakdown?.with_polygon?.percentage ??
                    0,
                  data.building_polygon_breakdown?.with_polygon?.count ?? 0,
                  data.building_polygon_breakdown_total,
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className={styles.tableCell}>
                {s.mapDisplayWithoutPolygon}
              </TableCell>
              <TableCell className={styles.tableCell}>
                {formatPercentage(
                  data.building_polygon_breakdown?.without_polygon
                    ?.percentage ?? 0,
                  data.building_polygon_breakdown?.without_polygon?.count ?? 0,
                  data.building_polygon_breakdown_total,
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className={styles.tableCell}>
                {s.mapDisplayExcluded}
              </TableCell>
              <TableCell className={styles.tableCell}>
                {formatPercentage(
                  data.building_polygon_breakdown?.excluded_from_display
                    ?.percentage ?? 0,
                  data.building_polygon_breakdown?.excluded_from_display
                    ?.count ?? 0,
                  data.building_polygon_breakdown_total,
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
