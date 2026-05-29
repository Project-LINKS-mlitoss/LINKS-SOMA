import {
  Caption1,
  Dialog,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { useDialogState } from "../../../../../../shared/hooks/use-dialog-state";
import { usePagination } from "../../../../../../shared/hooks/use-pagination";
import { Pagination } from "../../../../../../shared/components/ui/pagination";
import { DataPreviewTable } from "../../data-preview-table";
import { useFetchResultDataSetsWithPagination } from "../../../../hooks/use-fetch-result-data-sets-with-pagination";
import { ROUTES } from "../../../../../../shared/config/routes";
import { usePreviewSearchQuery } from "../../../../hooks/use-preview-search-query";
import { Button } from "../../../../../../shared/components/ui/button";
import { DialogSurface } from "../../../../../../shared/components/ui/dialog-surface";
import { DialogTitle } from "../../../../../../shared/components/ui/dialog-title";
import { DialogBody } from "../../../../../../shared/components/ui/dialog-body";
import { DialogContent } from "../../../../../../shared/components/ui/dialog-content";
import {
  translateColumnToJapanese,
  type DatasetType,
} from "../../../../../../shared/column-translation-utils";
import {
  BUILDING_DATASET_COLUMN_METADATA,
  AREA_DATASET_COLUMN_METADATA,
} from "../../../../../../shared/config/column-metadata";
import {
  QueryHeaderWithPagination,
  QueryHeaderWrapper,
} from "../../../../../bi/components/shared/query-header";

const useStyles = makeStyles({
  dataPreviewTableContainer: {
    marginTop: tokens.spacingVerticalS,
    minHeight: "80vh",
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  content: {
    paddingBottom: tokens.spacingVerticalXXL,
  },
  label: {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase100,
    borderRadius: tokens.borderRadiusSmall,
    color: "#616161",
  },
});

type Props = {
  title: string;
};

export const PreviewDialog = ({ title }: Props): JSX.Element => {
  const styles = useStyles();
  const dialogState = useDialogState(false);

  const navigate = useNavigate();
  const { previewId, previewType } = usePreviewSearchQuery();

  const pagination = usePagination({
    perPage: 50,
    total: 0,
  });

  // ページネーション状態に応じてデータを取得
  const { data: response } = useFetchResultDataSetsWithPagination({
    dataSetResultId: previewId ? Number(previewId) : null,
    type: previewType || "building",
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
  });

  const rows = useMemo(() => response?.data ?? [], [response?.data]);

  // totalCountは初回取得後に保持し、ちらつきを防止
  const [cachedTotalCount, setCachedTotalCount] = useState<number | null>(null);

  useEffect(() => {
    if (response?.totalCount != null && cachedTotalCount === null) {
      setCachedTotalCount(response.totalCount);
    }
  }, [response?.totalCount, cachedTotalCount]);

  // previewIdが変わったらリセット
  useEffect(() => {
    setCachedTotalCount(null);
  }, [previewId]);

  const totalCount = cachedTotalCount ?? 0;

  const parsedData = useMemo(
    () => parseResultDataSets(rows, previewType || "building"),
    [rows, previewType],
  );

  useEffect(() => {
    if (previewId && previewType) {
      dialogState.setIsOpen(true);
    }
  }, [dialogState, previewId, previewType]);

  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog
      onOpenChange={(e) => {
        e.stopPropagation();
        setIsOpen((prev) => !prev);
        if (isOpen) {
          navigate(
            ROUTES.DATASET({
              queryParams: {
                tab: "result",
              },
            }),
          );
        }
      }}
      open={isOpen}
    >
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogTitle className={styles.dialogTitle}>
          <div className={styles.actions}>
            <Button
              appearance="transparent"
              icon={<ArrowLeftRegular />}
              onClick={() => {
                setIsOpen(false);
                navigate(
                  ROUTES.DATASET({
                    queryParams: {
                      tab: "result",
                    },
                  }),
                );
              }}
            />
            {title}
            <span className={styles.label}>
              ({previewType === "building" ? "建物単位" : "地域単位"})
            </span>
          </div>
        </DialogTitle>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div>
              <QueryHeaderWrapper>
                <QueryHeaderWithPagination
                  allCount={totalCount}
                  currentDataLength={rows.length}
                  pagination={{ ...pagination, total: totalCount }}
                />
                <Pagination
                  {...pagination}
                  totalPages={
                    Math.ceil(totalCount / pagination.limitPerPage) || 1
                  }
                />
              </QueryHeaderWrapper>
              <div className={styles.dataPreviewTableContainer}>
                {rows.length === 0 ? (
                  <Caption1>データがありません</Caption1>
                ) : (
                  <DataPreviewTable data={parsedData} />
                )}
              </div>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

type DataRow = Record<string, string | number | null>;

/**
 * 推定結果データのカラム名を日本語名に変換したり値に単位を付与したりする。
 * @param data 推定結果データ
 * @param datasetType データセットの種類（building/area）
 * @returns 変換後のデータ
 */
function parseResultDataSets(
  data: DataRow[],
  datasetType: DatasetType,
): DataRow[] {
  if (!data || data.length === 0) return data;

  const columnMetadata =
    datasetType === "building"
      ? BUILDING_DATASET_COLUMN_METADATA
      : AREA_DATASET_COLUMN_METADATA;

  const parsedData = data.map((row) => {
    const newRow: DataRow = {};

    for (const enKey in row) {
      const value = row[enKey];
      const jpKey = translateColumnToJapanese(enKey, datasetType);
      const unit =
        (columnMetadata as Record<string, { unit?: string }>)[enKey]?.unit ??
        "";

      // null/undefined/空文字列はnullに変換（DataPreviewTableで--表示される）
      if (value === null || value === undefined || value === "") {
        newRow[jpKey] = null;
        continue;
      }

      if (unit === "%") {
        if (typeof value === "string") {
          newRow[jpKey] = value;
          continue;
        }
        if (value === 0) {
          newRow[jpKey] = "0%";
          continue;
        }
        if (value !== 0 && value < 1) {
          newRow[jpKey] = `${(value * 100).toFixed(0)}${unit}`;
          continue;
        }
        if (value >= 1) {
          newRow[jpKey] = `${value.toFixed(0)}${unit}`;
          continue;
        }
      }
      newRow[jpKey] = unit ? `${value}${unit}` : value;
    }

    return newRow;
  });

  return parsedData;
}
