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
  Checkbox,
  Spinner,
} from "@fluentui/react-components";
import {
  ArrowSortRegular,
  DismissFilled,
  SearchRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Tab } from "../../../../shared/components/ui/tab";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { useFetchNormalizedDatasets } from "../../../dataset/hooks/use-fetch-normalized-datasets";
import { type ReturnUseDialogState } from "../../../../shared/hooks/use-dialog-state";
import { type SelectNormalizedDataSet } from "../../../../db/schema";
import { saveDataSetFile } from "../../../../shared/utils/save-data-set-file";
import { formatByteValue } from "../../../../shared/utils/format-byte-value";
import { Button } from "../../../../shared/components/ui/button";
import { DialogSurface } from "../../../../shared/components/ui/dialog-surface";
import { DialogBody } from "../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../shared/components/ui/dialog-title";
import { DialogContent } from "../../../../shared/components/ui/dialog-content";
import { DialogActions } from "../../../../shared/components/ui/dialog-actions";
import { Input } from "../../../../shared/components/ui/input";

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
    flexDirection: "column",
    gap: tokens.spacingVerticalMNudge,
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
  checkbox: {
    marginRight: tokens.spacingHorizontalS,
  },
  // FileUploader styles
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    border: "2px dashed #ccc",
    borderRadius: "5px",
    cursor: "pointer",
    padding: tokens.spacingHorizontalM,
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    width: "100%",
    maxHeight: "250px",
    overflowY: "auto",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  fileInfo: {
    display: "flex",
    flexDirection: "column",
  },
  fileName: {
    fontSize: tokens.fontSizeBase300,
  },
  fileSize: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  dropzoneText: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
});

type TabValue = "select" | "upload";

type Props = {
  dialogState: ReturnUseDialogState;
  onSelected?: (data: SelectNormalizedDataSet[]) => void;
  existingPaths?: string[];
};

export const DialogSelectAnalysisDataset = ({
  dialogState,
  onSelected,
  existingPaths = [],
}: Props): JSX.Element => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<TabValue>("select");
  const [selectedDataSets, setSelectedDataSets] = useState<
    SelectNormalizedDataSet[]
  >([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, setIsOpen } = dialogState;
  const { data: normalizedDataSets, mutate } = useFetchNormalizedDatasets();

  const dataItems = normalizedDataSets ?? [];
  const filteredDataItems = dataItems.filter((dataset) =>
    dataset.file_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRowClick = (
    dataset: SelectNormalizedDataSet,
    newState?: boolean,
  ): void => {
    setSelectedDataSets((prev) => {
      const isCurrentlySelected = prev.some((d) => d.id === dataset.id);
      const shouldSelect = newState ?? !isCurrentlySelected;

      if (shouldSelect && !isCurrentlySelected) {
        return [...prev, dataset];
      } else if (!shouldSelect && isCurrentlySelected) {
        return prev.filter((d) => d.id !== dataset.id);
      }

      return prev;
    });
  };

  const handleClick = async (): Promise<void> => {
    if (!onSelected) return;

    switch (selectedTab) {
      case "select":
        if (selectedDataSets.length === 0) return;
        onSelected(selectedDataSets);
        dialogState.setIsOpen(false);
        resetState();
        break;
      case "upload":
        {
          if (uploadedFiles.length === 0) return;
          try {
            setIsLoading(true);

            // 複数ファイルをアップロード
            const uploadedDatasets: SelectNormalizedDataSet[] = [];
            for (const file of uploadedFiles) {
              const result = await saveDataSetFile(file, "normalization");
              if (!result?.insertedId) {
                throw new Error(
                  `ファイルの保存中にエラーが発生しました: ${file.name}`,
                );
              }
              const dataset = await window.ipcRenderer.invoke(
                "selectNormalizedDataSet",
                { id: result.insertedId },
              );
              if (dataset) {
                uploadedDatasets.push(dataset);
              }
            }

            // データ一覧を更新
            await mutate();

            if (uploadedDatasets.length > 0) {
              onSelected(uploadedDatasets);
            }
          } catch (error) {
            rendererLogger.error("Dataset upload failed", error, {
              fileNames: uploadedFiles.map((f) => f.name),
              component: "DialogSelectAnalysisDataset",
            });
          } finally {
            setIsLoading(false);
            dialogState.setIsOpen(false);
            resetState();
          }
        }
        break;
      default: {
        const _exhaustiveCheck: never = selectedTab;
        throw new Error(`Unexpected tab value: ${_exhaustiveCheck}`);
      }
    }
  };

  const resetState = (): void => {
    setSelectedDataSets([]);
    setUploadedFiles([]);
    setSearchQuery("");
    setSelectedTab("select");
  };

  const handleTabChange = (_: SelectTabEvent, data: SelectTabData): void => {
    setSelectedTab(data.value as TabValue);
  };

  const handleFileDrop = (acceptedFiles: File[]): void => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles]);
  };

  const handleFileRemove = (index: number): void => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    multiple: true,
  });

  const isDisabledButton =
    (selectedTab === "select" && selectedDataSets.length === 0) ||
    (selectedTab === "upload" && uploadedFiles.length === 0);

  // 既に選択されているパスを除外してチェック済み表示
  const isAlreadySelected = (dataset: SelectNormalizedDataSet): boolean => {
    return existingPaths.includes(dataset.file_path ?? "");
  };

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
            分析を行う名寄せ処理済みデータセットを選択
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
                  {filteredDataItems.length > 0 ? (
                    <TableBody className={styles.tableBody}>
                      {filteredDataItems.map((dataset) => {
                        const isSelected = selectedDataSets.some(
                          (d) => d.id === dataset.id,
                        );
                        const isDisabled = isAlreadySelected(dataset);
                        return (
                          <TableRow
                            key={dataset.id}
                            className={mergeClasses(
                              styles.datasetTable,
                              isSelected || isDisabled
                                ? styles.selectedDatasetTable
                                : styles.borderBottom,
                            )}
                            onClick={() =>
                              !isDisabled && handleRowClick(dataset)
                            }
                            style={isDisabled ? { opacity: 0.5 } : undefined}
                          >
                            <TableCell
                              className={mergeClasses(
                                styles.datasetCell,
                                styles.dataName,
                              )}
                            >
                              <Checkbox
                                checked={isSelected || isDisabled}
                                className={styles.checkbox}
                                disabled={isDisabled}
                                onChange={(ev, data) => {
                                  ev.stopPropagation();
                                  const checkedValue =
                                    data.checked === "mixed"
                                      ? false
                                      : data.checked;
                                  handleRowClick(dataset, checkedValue);
                                }}
                              />
                              {dataset.file_name ?? "名称未設定"}
                            </TableCell>
                            <TableCell className={styles.datasetCell}>
                              {dataset.created_at}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                {isLoading ? (
                  <div className={styles.dropzone}>
                    <Spinner />
                    ファイルをアップロード中です...
                  </div>
                ) : uploadedFiles.length > 0 ? (
                  <div className={styles.fileList}>
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className={styles.fileItem}
                      >
                        <div className={styles.fileInfo}>
                          <span className={styles.fileName}>{file.name}</span>
                          <span className={styles.fileSize}>
                            {formatByteValue(file.size, { unit: "MB" })}
                          </span>
                        </div>
                        <Button
                          appearance="subtle"
                          icon={<DeleteRegular />}
                          onClick={() => handleFileRemove(index)}
                        />
                      </div>
                    ))}
                    <div
                      {...getRootProps()}
                      className={styles.dropzone}
                      style={{
                        height: "80px",
                        marginTop: tokens.spacingVerticalS,
                      }}
                    >
                      <input {...getInputProps()} />
                      <p className={styles.dropzoneText}>+ ファイルを追加</p>
                    </div>
                  </div>
                ) : (
                  <div {...getRootProps()} className={styles.dropzone}>
                    <input {...getInputProps()} />
                    {isDragActive ? (
                      <p className={styles.dropzoneText}>
                        ここにファイルをドロップしてください
                      </p>
                    ) : (
                      <p className={styles.dropzoneText}>
                        ファイルをドラッグ＆ドロップ
                        <br />
                        またはクリックして選択
                      </p>
                    )}
                  </div>
                )}
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
