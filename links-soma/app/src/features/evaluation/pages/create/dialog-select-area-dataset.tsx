import {
  Dialog,
  tokens,
  makeStyles,
  type SelectTabData,
  type SelectTabEvent,
  TabList,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  mergeClasses,
  DialogTrigger,
} from "@fluentui/react-components";
import {
  ArrowSortRegular,
  DismissFilled,
  SearchRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { useFetchRawDatasets } from "../../../dataset/hooks/use-fetch-raw-datasets";
import { type ReturnUseDialogState } from "../../../../shared/hooks/use-dialog-state";
import { type SelectRawDataSet } from "../../../../db/schema";
import { saveDataSetFile } from "../../../../shared/utils/save-data-set-file";
import {
  Tab,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  FileUploader,
  Input,
} from "../../../../shared/components/ui";
import { ErrorMessage } from "../../../../shared/components/error-message";
import { EncodingWarning } from "../../../../shared/components/encoding-warning";
import { detectNonUtf8Files } from "../../../../shared/utils/detect-non-utf8-files";

const useStyles = makeStyles({
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icon: {
    width: "24px",
    height: "24px",
    ":hover": { cursor: "pointer" },
  },
  noDatasetWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "293px",
  },
  uploadWrap: {
    height: "325px",
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingVerticalS} ${tokens.spacingHorizontalMNudge}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  noDataset: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  tab: {
    padding: `${tokens.spacingVerticalMNudge} ${tokens.spacingHorizontalNone}`,
  },
  tabList: {
    display: "flex",
    gap: tokens.spacingVerticalXL,
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingHorizontalXXL}`,
  },
  tableHeader: {
    display: "block",
  },
  tableBody: {
    height: "293px",
  },
  datasetTable: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingVerticalS,
    ":hover": { cursor: "pointer" },
  },
  borderBottom: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  selectedDatasetTable: {
    border: "1px solid #6264A7",
    backgroundColor: "#E9EAF6",
  },
  datasetCell: {
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingHorizontalXXL}`,
    fontSize: tokens.fontSizeBase200,
    display: "flex",
    alignItems: "center",
  },
  datasetHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    ":hover": { cursor: "pointer" },
  },
  tableHeight: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  dataName: {
    color: "#6264A7",
    textDecoration: "underline",
  },
  disabledButton: {
    backgroundColor: "#EFF0F0",
    color: "#89949F",
    cursor: "not-allowed",
    ":hover": {
      backgroundColor: "#EFF0F0",
    },
  },
  searchBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "60px",
    width: "100%",
    backgroundColor: "#F5F5F5",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  input: {
    width: "100%",
  },
});

type TabValue = "select" | "upload";

type Props = {
  dialogState: ReturnUseDialogState;
  onSelected?: (data: SelectRawDataSet) => void;
};

/**
 * 地域集計用データ（raw_data_sets）を「既存から選択」または「新規アップロード」で
 * 1件選ぶダイアログ。推定実行フォーム（FN009）専用。
 *
 * 単一選択 + raw データセット対象である点が、分析対象データ用の
 * DialogSelectAnalysisDataset（複数選択 + 名寄せ済データ対象）と異なる。
 */
export const DialogSelectAreaDataset = ({
  dialogState,
  onSelected,
}: Props): JSX.Element => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<TabValue>("select");
  const [selectedDataSet, setSelectedDataSet] =
    useState<SelectRawDataSet | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [nonUtf8Files, setNonUtf8Files] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { isOpen, setIsOpen } = dialogState;
  const { data: rawDataSets, mutate } = useFetchRawDatasets();

  const filteredDataSets = (rawDataSets ?? []).filter((dataSet) =>
    dataSet.file_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const resetState = (): void => {
    setSelectedDataSet(null);
    setUploadedFile(null);
    setNonUtf8Files([]);
    setSearchQuery("");
    setUploadError(null);
    setSelectedTab("select");
  };

  const handleClick = async (): Promise<void> => {
    if (!onSelected) return;

    switch (selectedTab) {
      case "select":
        if (!selectedDataSet) return;
        onSelected(selectedDataSet);
        dialogState.setIsOpen(false);
        resetState();
        break;
      case "upload":
        {
          if (!uploadedFile) return;
          try {
            setIsLoading(true);
            setUploadError(null);
            const result = await saveDataSetFile(uploadedFile, "raw");
            if (!result?.insertedId)
              throw new Error("ファイルの保存中にエラーが発生しました");
            const rawDataSet = await window.ipcRenderer.invoke(
              "selectRawDataset",
              { id: result.insertedId },
            );
            if (!rawDataSet)
              throw new Error("データセットの取得中にエラーが発生しました");
            await mutate();
            // 成功時のみダイアログを閉じる。失敗時は開いたままエラーを表示して再試行させる。
            onSelected(rawDataSet);
            dialogState.setIsOpen(false);
            resetState();
          } catch (error) {
            rendererLogger.error("Area dataset upload failed", error, {
              fileName: uploadedFile?.name,
              fileSize: uploadedFile?.size,
              component: "DialogSelectAreaDataset",
            });
            setUploadError(
              "ファイルのアップロードに失敗しました。ファイルを確認して再度お試しください。",
            );
          } finally {
            setIsLoading(false);
          }
        }
        break;
      default: {
        const _exhaustiveCheck: never = selectedTab;
        throw new Error(`Unexpected tab value: ${_exhaustiveCheck}`);
      }
    }
  };

  const handleTabChange = (_: SelectTabEvent, data: SelectTabData): void => {
    setSelectedTab(data.value as TabValue);
    // タブ切替で両タブの一時状態を破棄する。FileUploader は再マウントで表示が
    // リセットされるため、uploadedFile を残すと「表示は空だが送信可能」な不整合になる。
    setSelectedDataSet(null);
    setUploadedFile(null);
    setNonUtf8Files([]);
    setUploadError(null);
  };

  const isDisabledButton =
    (selectedTab === "select" && !selectedDataSet) ||
    (selectedTab === "upload" && !uploadedFile);

  return (
    <Dialog
      onOpenChange={(_, { open }) => {
        setIsOpen(open);
        if (!open) {
          resetState();
        }
      }}
      open={isOpen}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <DismissFilled className={styles.icon} strokeWidth={2} />
                  }
                />
              </DialogTrigger>
            }
            className={styles.dialogTitle}
          >
            地域集計用データを選択
          </DialogTitle>
          <DialogContent padding={false}>
            <TabList
              className={styles.tabList}
              onTabSelect={handleTabChange}
              selectedValue={selectedTab}
            >
              <Tab className={styles.tab} value="select">
                データセットから選択
              </Tab>
              <Tab className={styles.tab} value="upload">
                新規アップロード
              </Tab>
            </TabList>
            {selectedTab === "select" && (
              <>
                <div className={styles.searchBox}>
                  <Input
                    className={styles.input}
                    contentBefore={<SearchRegular />}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="データ名"
                    value={searchQuery}
                  />
                </div>
                <Table className={styles.tableHeight}>
                  <TableHeader className={styles.tableHeader}>
                    <TableRow
                      className={mergeClasses(
                        styles.datasetTable,
                        styles.borderBottom,
                      )}
                    >
                      <TableHeaderCell
                        className={mergeClasses(
                          styles.datasetCell,
                          styles.datasetHeader,
                        )}
                      >
                        データセット名
                        <ArrowSortRegular />
                      </TableHeaderCell>
                      <TableHeaderCell
                        className={mergeClasses(
                          styles.datasetCell,
                          styles.datasetHeader,
                        )}
                      >
                        最終更新
                        <ArrowSortRegular />
                      </TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  {filteredDataSets.length > 0 ? (
                    <TableBody className={styles.tableBody}>
                      {filteredDataSets.map((dataSet) => (
                        <TableRow
                          key={dataSet.id}
                          className={mergeClasses(
                            styles.datasetTable,
                            selectedDataSet?.id === dataSet.id
                              ? styles.selectedDatasetTable
                              : styles.borderBottom,
                          )}
                          onClick={() => setSelectedDataSet(dataSet)}
                        >
                          <TableCell
                            className={mergeClasses(
                              styles.datasetCell,
                              styles.dataName,
                            )}
                          >
                            {dataSet.file_name}
                          </TableCell>
                          <TableCell className={styles.datasetCell}>
                            {dataSet.created_at}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  ) : (
                    <div className={styles.noDatasetWrap}>
                      <span className={styles.noDataset}>
                        現在表示できるデータセットはありません
                      </span>
                    </div>
                  )}
                </Table>
              </>
            )}
            {selectedTab === "upload" && (
              <div className={styles.uploadWrap}>
                {uploadError && <ErrorMessage msg={uploadError} />}
                <FileUploader
                  isLoading={isLoading}
                  onUpload={async (file) => {
                    setUploadedFile(file);
                    setUploadError(null);
                    // PV-01 文字コード: 非UTF-8 を非ブロッキングで注意（選択は妨げない）。
                    setNonUtf8Files(
                      file ? await detectNonUtf8Files([file]) : [],
                    );
                  }}
                />
                <EncodingWarning fileNames={nonUtf8Files} />
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              className={isDisabledButton ? styles.disabledButton : ""}
              disabled={isDisabledButton || isLoading}
              onClick={handleClick}
            >
              データを決定
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
