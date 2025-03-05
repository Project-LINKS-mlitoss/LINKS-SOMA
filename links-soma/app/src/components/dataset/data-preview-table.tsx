import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHeader,
  TableHeaderCell,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    tableLayout: "auto",
  },
  th: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  td: {
    minWidth: "153px",
  },
});

interface Props {
  data: Record<string, string | number | null>[] | undefined;
}

export function DataPreviewTable({ data }: Props): JSX.Element {
  const styles = useStyles();
  const headers = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className={styles.tableContainer}>
      <Table aria-label="CSV Data Table" className={styles.table}>
        <TableHeader className={styles.th}>
          <TableRow>
            {headers.map((header) => (
              <TableHeaderCell key={header}>{header}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {headers.map((header) => (
                <TableCell key={`${rowIndex}-${header}`} className={styles.td}>
                  {row[header]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
