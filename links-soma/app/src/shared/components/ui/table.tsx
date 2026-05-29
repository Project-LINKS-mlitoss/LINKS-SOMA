import {
  Table as FUITable,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  mergeClasses,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  tableHeader: {
    backgroundColor: "#f3f2f1",
  },
  tableHeaderRow: {
    border: "none",
  },
  tableHeaderCell: {
    fontWeight: "600",
  },
  tableBody: {
    backgroundColor: "#fff",
    fontSize: "12px",
  },
});

export interface ColumnDefinition<T> {
  key: keyof T;
  name: string;
  className?: string;
  onRender?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: ColumnDefinition<T>[];
  items: T[];
  style?: React.CSSProperties;
}

export function Table<T>({ columns, items }: TableProps<T>): JSX.Element {
  const styles = useStyles();

  return (
    <FUITable>
      <TableHeader className={styles.tableHeader}>
        <TableRow className={styles.tableHeaderRow}>
          {columns.map((column) => (
            <TableHeaderCell
              key={String(column.key)}
              className={mergeClasses(styles.tableHeaderCell, column.className)}
            >
              {column.name}
            </TableHeaderCell>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className={styles.tableBody}>
        {items.map((item, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((column) => (
              <TableCell key={String(column.key)}>
                {column.onRender
                  ? column.onRender(item)
                  : (item[column.key] as React.ReactNode)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </FUITable>
  );
}
