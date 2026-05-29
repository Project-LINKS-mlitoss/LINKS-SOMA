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
import { Pagination } from "../../../../shared/components/ui/pagination";
import { usePagination } from "../../../../shared/hooks/use-pagination";
import { useFetchRawOrNormalizedDataSetFile } from "../../hooks/use-fetch-raw-or-normalized-data-set-file";

const useStyles = makeStyles({
  dataPreviewTableContainer: {
    marginTop: tokens.spacingVerticalS,
  },
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
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "8rem",
  },
});

interface Props {
  id: number;
}

export function NormalizedDataPreviewTable({ id }: Props): JSX.Element {
  const styles = useStyles();

  const pagination = usePagination({
    perPage: 50,
    total: 0 /* データ取得APIが件数を返さないため、ページネーション総数は未実装 */,
  });
  const { data, isLoading } = useFetchRawOrNormalizedDataSetFile({
    id,
    type: "normalized",
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
  });

  const headers = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div>
      <Pagination {...pagination} />
      <div className={styles.dataPreviewTableContainer}>
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
              {isLoading && <div className={styles.loading}>Loading...</div>}
              {data?.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {headers.map((header) => (
                    <TableCell
                      key={`${rowIndex}-${header}`}
                      className={styles.td}
                    >
                      {row[header]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
