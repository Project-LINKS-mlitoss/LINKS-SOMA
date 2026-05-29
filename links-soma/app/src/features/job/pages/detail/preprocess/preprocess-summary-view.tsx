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

  const formatPercentage = (
    percentage: number,
    count: number,
    total: number,
  ): string => {
    return `${percentage.toFixed(1)}% (${count.toLocaleString()}件/${total.toLocaleString()}件中)`;
  };

  const renderStatusText = (hasData: boolean): JSX.Element => {
    return (
      <Text
        className={mergeClasses(
          styles.statusText,
          hasData ? styles.hasData : styles.noData,
        )}
      >
        {hasData ? "あり" : "なし"}
      </Text>
    );
  };

  return (
    <div className={styles.container}>
      {/* 総件数 */}
      <Card className={styles.card}>
        <Text className={styles.sectionTitle}>
          名寄せ処理済データ（推定対象）の総件数
        </Text>
        <div>
          <Text className={styles.totalCountLabel}>件数</Text>
          <br />
          <Text className={styles.totalCount}>
            {data.estimation_target_total_count.toLocaleString()}件
          </Text>
        </div>
      </Card>

      <Text className={styles.sectionTitleWithMargin}>
        名寄せ処理済データの内訳
      </Text>

      {/* 名寄せ処理済データの内訳 */}
      <Card className={styles.card}>
        {/* レコードの組み合わせ別 */}
        <Text className={styles.sectionTitle}>レコードの組み合わせ別</Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                水道開閉栓状況
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                住民基本台帳
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                登記情報
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                構成比
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
        <Text className={styles.sectionTitle}>家屋種別</Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                種別
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                構成比
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className={styles.tableCell}>
                ユーザーが指定した種別
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
              <TableCell className={styles.tableCell}>種別不明</TableCell>
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
        <Text className={styles.sectionTitle}>地図表示別</Text>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell className={styles.headerCell}>
                種別
              </TableHeaderCell>
              <TableHeaderCell className={styles.headerCell}>
                構成比
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className={styles.tableCell}>
                建物ポリゴン表示
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
              <TableCell className={styles.tableCell}>ポイント表示</TableCell>
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
                表示対象外（座標なし）
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
