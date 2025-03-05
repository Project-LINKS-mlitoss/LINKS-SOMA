import {
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Pagination } from "../ui/pagination";
import { type TableView } from "../../bi-modules/interfaces/view";
import { useFetchTableProps } from "../../bi-modules/hooks/use-fetch-table-props";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: `${tokens.spacingVerticalS}`,
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  tableHeaderRow: {
    border: "none",
  },
  tableHeaderCell: {
    fontWeight: tokens.fontWeightSemibold,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  table: {
    tableLayout: "auto",
  },
  tableContainer: {
    overflowX: "scroll",
    whiteSpace: "nowrap",
  },
});

type Props = {
  view: TableView;
};

export const ViewTable = ({ view }: Props): JSX.Element => {
  const { tableProps, pagination } = useFetchTableProps({
    view,
  });

  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Pagination {...pagination} />
      <div className={styles.tableContainer}>
        <Table className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow className={styles.tableHeaderRow}>
              {tableProps.columns.map((column, index) => {
                return (
                  <TableHeaderCell
                    key={index}
                    className={styles.tableHeaderCell}
                  >
                    {column.label}
                  </TableHeaderCell>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableProps.data
              .map((row, index) => {
                return (
                  <TableRow key={index}>
                    {tableProps.columns.map((column, index) => {
                      return (
                        <TableCell key={index}>
                          {row[column.key]}
                          {column.unit ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
              .flat(-1)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
