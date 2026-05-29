import {
  makeStyles,
  tokens,
  Button,
  typographyStyles,
} from "@fluentui/react-components";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Table,
  type ColumnDefinition,
} from "../../../../../shared/components/ui/table";
import { Pagination } from "../../../../../shared/components/ui/pagination";
import { useFetchBuildingPreview } from "../../../hooks/use-fetch-preview-data";
import { type PreviewData } from "../../../../bi/ipc/select-building-preview";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../../../shared/components/ui/breadcrumb";
import { ROUTES } from "../../../../../shared/config/routes";
import { downloadFile } from "../../../../../shared/utils/download-file";
import { useFetchJobResults } from "../../../hooks/use-fetch-job-results";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXL,
  },
  historyBack: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    cursor: "pointer",
  },
  previewWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalXXL,
    maxWidth: "calc(100vw - 132px)",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  preview: {
    display: "flex",
    alignItems: "center",
    justifyContent: "end",
    gap: tokens.spacingVerticalM,
  },
  button: {
    borderRadius: "100px",
    height: "32px",
    width: "120px",
  },
  tableContainer: {
    overflowX: "auto",
    maxHeight: "500px",
    width: "100%",
  },
  text: typographyStyles.subtitle2,
  pagenation: {
    display: "flex",
    justifyContent: "flex-start",
  },
  headerColumn: {
    width: "150px",
  },
});

export function JobPreview(): JSX.Element {
  const styles = useStyles();
  const [page, setPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(10);

  const { id } = useParams<{ id: string }>();
  const dataSetResultId = Number(id);

  const { data } = useFetchBuildingPreview(dataSetResultId);
  const { data: jobResultsData } = useFetchJobResults({
    jobId: dataSetResultId,
  });

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
  };

  const handleLimitPerPageChange = (newLimit: number): void => {
    setLimitPerPage(newLimit);
    setPage(1);
  };

  const paginatedData = data?.slice(
    (page - 1) * limitPerPage,
    page * limitPerPage,
  );

  // カラム定義
  const columns: ColumnDefinition<PreviewData>[] = [
    {
      key: "normalized_address",
      name: "住所",
      className: useStyles().headerColumn,
    },
    {
      key: "water_supply_number",
      name: "水道番号",
      className: useStyles().headerColumn,
    },
    {
      key: "area_group",
      name: "町丁目",
      className: useStyles().headerColumn,
    },
    {
      key: "predicted_probability",
      name: "空き家推定確率",
      className: useStyles().headerColumn,
      onRender: (item) => `${item.predicted_probability.toFixed(2)}%`,
    },
  ];

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "処理一覧",
            href: ROUTES.JOB.ROOT,
          },
          {
            children: "処理結果 - 名寄せ処理",
            href: ROUTES.JOB.DETAIL_PREPROCESS(id || ""),
          },
          {
            children: "プレビュー",
            current: true,
            href: ROUTES.JOB.PREVIEW(id || ""),
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>ファイルのプレビュー</h2>
      <div className={styles.previewWrapper}>
        <div className={styles.preview}>
          <Button
            className={styles.button}
            onClick={async () => {
              if (!jobResultsData) return;
              await downloadFile(jobResultsData.file_path);
            }}
          >
            ダウンロード
          </Button>
        </div>

        <div className={styles.tableContainer}>
          <Table columns={columns} items={paginatedData ?? []} />
        </div>
        <div className={styles.pagenation}>
          <Pagination
            handleLimitPerPageChange={handleLimitPerPageChange}
            handlePageChange={handlePageChange}
            limitPerPage={limitPerPage}
            page={page}
            total={0}
            totalPages={0}
          />
        </div>
      </div>
    </div>
  );
}
