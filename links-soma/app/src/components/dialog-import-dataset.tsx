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
import { ArrowSortRegular, DismissFilled } from "@fluentui/react-icons";
import { useState } from "react";
import { Tab } from "../components/ui/tab";
import { useFetchRawDatasets } from "../hooks/use-fetch-raw-datasets";
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { type SelectRawDataSet } from "../schema";
import { saveDataSetFile } from "../utils/save-data-set-file";
import { Button } from "./ui/button";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { DialogActions } from "./ui/dialog-actions";
import { FileUploader } from "./ui/file-uploader/file-uploader";

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
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingVerticalS} ${
      tokens.spacingHorizontalMNudge
    }`,
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
  menuItemButton: {
    justifyContent: "flex-start",
    padding: 0,
    fontWeight: "normal",
    width: "100%",
  },
});

type TabValue = "select" | "upload";

type Props = {
  dialogState: ReturnUseDialogState;
  onSubmit?: (data: SelectRawDataSet) => void;
};

export const DialogImportDataset = ({
  dialogState,
  onSubmit,
}: Props): JSX.Element => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState<TabValue>("select");
  const [selectedDataSet, setSelectedDataSet] =
    useState<SelectRawDataSet | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen, setIsOpen } = dialogState;
  const { data: rawDataSets } = useFetchRawDatasets();

  const handleClick = async (): Promise<void> => {
    if (!onSubmit) return;

    switch (selectedTab) {
      case "select":
        if (!selectedDataSet) return;
        onSubmit(selectedDataSet);
        dialogState.setIsOpen(false);
        break;
      case "upload":
        {
          // ファイルを保存→データセットを取得→onSubmit
          try {
            if (!uploadedFile) throw new Error("ファイルが選択されていません");
            setIsLoading(true);
            const result = await saveDataSetFile(uploadedFile);
            if (!result?.insertedId)
              throw new Error("ファイルの保存中にエラーが発生しました");
            const rawDataSet = await window.ipcRenderer.invoke(
              "selectRawDataset",
              {
                id: result.insertedId,
              },
            );
            if (!rawDataSet)
              throw new Error("データセットの取得中にエラーが発生しました");
            onSubmit(rawDataSet);
          } catch (error) {
            console.error(error);
          } finally {
            setIsLoading(false);
            dialogState.setIsOpen(false);
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
    setSelectedDataSet(null);
  };

  const isDisabledImportButton =
    (selectedTab === "select" && !selectedDataSet) ||
    (selectedTab === "upload" && !uploadedFile);

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
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
            インプットデータセット一覧から選択
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
                {rawDataSets && rawDataSets.length > 0 ? (
                  <TableBody className={styles.tableBody}>
                    {rawDataSets.map((dataSet) => (
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
            )}
            {selectedTab === "upload" && (
              <div className={styles.uploadWrap}>
                <FileUploader
                  isLoading={isLoading}
                  onUpload={(file) => {
                    setUploadedFile(file);
                  }}
                />
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              className={isDisabledImportButton ? styles.disabledButton : ""}
              disabled={isDisabledImportButton}
              onClick={handleClick}
            >
              選択
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
