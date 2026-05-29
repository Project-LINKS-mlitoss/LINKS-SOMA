import {
  Caption1,
  Card,
  makeStyles,
  tokens,
  Table,
  TableBody,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useFetchJobsWithPagination } from "../hooks/use-fetch-jobs-with-pagination";
import { notifyJobChanged } from "../hooks/job-change-notifier";
import { TableHeaderJobs } from "../components/table-header-jobs";
import { TableRowJobs } from "../components/table-rows-jobs";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../shared/components/ui/breadcrumb";
import { ROUTES } from "../../../shared/config/routes";
import { Pagination } from "../../../shared/components/ui/pagination";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

const useStyles = makeStyles({
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
  paginationWrapper: {
    display: "flex",
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
});

export function Job(): JSX.Element {
  const styles = useStyles();
  const [totalCount, setTotalCount] = useState(0);
  const pagination = usePagination({
    perPage: 50,
    total: totalCount,
  });
  const { data: response } = useFetchJobsWithPagination({
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
    excludeDraft: true,
  });

  useEffect(() => {
    if (response?.totalCount !== undefined) {
      setTotalCount(response.totalCount);
    }
  }, [response?.totalCount]);

  const jobs = response?.data;
  const hasData = jobs && jobs.length > 0;

  // 削除に成功した場合データを再取得する
  const handleDeleteSuccess = async (id: number): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteJob", { id });
      notifyJobChanged();
    } catch (error) {
      rendererLogger.error("Failed to delete job", {
        error,
        jobId: id,
      });
    }
  };

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "処理一覧",
            current: true,
            href: ROUTES.JOB.ROOT,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>処理一覧</h2>

      <Card className={styles.content}>
        <div className={styles.paginationWrapper}>
          <Caption1>{totalCount}件</Caption1>
          <Pagination {...pagination} />
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
          <div className={styles.noData}>現在表示できる処理はありません</div>
        )}
      </Card>
    </div>
  );
}
