import {
  makeStyles,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
});

export const TableHeaderJobs = (): JSX.Element => {
  const styles = useStyles();

  return (
    <TableHeader className={styles.tableHeader}>
      <TableRow>
        <TableHeaderCell className={styles.headerCell}>
          処理開始日時
        </TableHeaderCell>
        <TableHeaderCell className={styles.headerCell}>
          処理の種類
        </TableHeaderCell>
        <TableHeaderCell className={styles.headerCell}>
          処理ステータス
        </TableHeaderCell>
        <TableHeaderCell className={styles.headerCell}>
          保存ステータス
        </TableHeaderCell>
        <TableHeaderCell></TableHeaderCell>
      </TableRow>
    </TableHeader>
  );
};
