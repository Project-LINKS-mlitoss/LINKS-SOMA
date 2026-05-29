import {
  Caption1,
  Caption1Strong,
  Table,
  TableBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useFetchJobsWithPagination } from "../hooks/use-fetch-jobs-with-pagination";
import { notifyJobChanged } from "../hooks/job-change-notifier";
import { type SelectJob } from "../../../db/schema";
import { Pagination } from "../../../shared/components/ui/pagination";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
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
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
});

type Props = {
  jobType: SelectJob["type"];
};

export const TableJobsByType = ({ jobType }: Props): JSX.Element => {
  const styles = useStyles();

  // ページ切替時のデータ再取得中にtotalCountが0にリセットされるのを防ぐため、前回の値を保持する
  const [totalCount, setTotalCount] = useState(0);
  const pagination = usePagination({
    perPage: 50,
    total: totalCount,
  });
  const { data: response } = useFetchJobsWithPagination({
    type: jobType,
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
  });

  useEffect(() => {
    if (response?.totalCount !== undefined) {
      setTotalCount(response.totalCount);
    }
  }, [response?.totalCount]);

  const jobs = response?.data;

  if (jobs === undefined) return <></>;

  const hasData = jobs.length > 0;

  // 削除に成功した場合データを再取得する
  const handleDeleteSuccess = async (id: number): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteJob", { id });
      // 購読中の全 hook (自身 + Normalization ページの useFetchDraftJob 等) に再取得を通知
      notifyJobChanged();
    } catch (error) {
      rendererLogger.error("Failed to delete job", error, {
        jobId: id,
        jobType,
        component: "TableJobsByType",
      });
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h4 className={styles.h4}>処理一覧</h4>
        <div className={styles.paginationWrapper}>
          <Caption1>{totalCount}件</Caption1>
          <Pagination {...pagination} />
        </div>
      </div>
      {hasData ? (
        <Table className={styles.table}>
          <TableHeaderJobs />
          <TableBody>
            {jobs.map((item) => (
              <TableRowJobs
                key={item.id}
                item={item}
                onDeleteSuccess={handleDeleteSuccess}
              />
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className={styles.notFound}>
          <Caption1Strong>現在実行中の処理はありません。</Caption1Strong>
          <Caption1>
            ※ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
          </Caption1>
        </div>
      )}
    </>
  );
};
