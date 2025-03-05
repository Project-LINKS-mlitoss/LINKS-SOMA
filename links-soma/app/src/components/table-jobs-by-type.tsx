import {
  Caption1,
  Caption1Strong,
  Table,
  TableBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useFetchJobsWithPagination } from "../hooks/use-fetch-jobs-with-pagination";
import { type SelectJob } from "../schema";
import { Pagination } from "../components/ui/pagination";
import { usePagination } from "../hooks/use-pagination";
import { TableHeaderJobs } from "./table-header-jobs";
import { TableRowJobs } from "./table-rows-jobs";

const useStyles = makeStyles({
  notFound: {
    fontSize: "14px",
    padding: `${tokens.spacingVerticalS} 0`,
    display: "grid",
    gap: tokens.spacingVerticalXS,
  },
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flexDirection: "column",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    gap: tokens.spacingVerticalXL,
  },
  table: {
    width: "100%",
  },
  noData: {
    color: "#616161",
    fontSize: tokens.fontSizeBase300,
  },
  header: {
    display: "flex",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h4: {
    width: "100%",
  },
  paginationWrapper: {
    display: "flex",
    width: "100%",
    justifyContent: "flex-end",
  },
});

type Props = {
  jobType: SelectJob["type"];
};

export const TableJobsByType = ({ jobType }: Props): JSX.Element => {
  const styles = useStyles();

  const pagination = usePagination(50);
  const { data, mutate } = useFetchJobsWithPagination({
    type: jobType,
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
  });

  if (data === undefined) return <></>;

  if (data.length === 0) {
    return (
      <>
        <div className={styles.header}>
          <h4 className={styles.h4}>処理一覧</h4>
        </div>
        <div className={styles.notFound}>
          <Caption1Strong>現在実行中の処理はありません。</Caption1Strong>

          <Caption1>
            ※ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
          </Caption1>
        </div>
      </>
    );
  }

  const hasData = data && data.length > 0;

  // 削除に成功した場合データを再取得する
  const handleDeleteSuccess = async (id: number): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteJob", { id });
      await mutate();
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h4 className={styles.h4}>処理一覧</h4>
        {hasData && (
          <div className={styles.paginationWrapper}>
            <Pagination {...pagination} />
          </div>
        )}
      </div>
      <Table className={styles.table}>
        <TableHeaderJobs />
        <TableBody>
          {data.map((item) => (
            <TableRowJobs
              key={item.id}
              item={item}
              onDeleteSuccess={handleDeleteSuccess}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
};
