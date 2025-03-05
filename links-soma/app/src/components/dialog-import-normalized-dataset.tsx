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
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { type SelectNormalizedDataSet } from "../schema";
import { useFetchNormalizedDatasets } from "../hooks/use-fetch-normalized-datasets";
import { Tab } from "./ui/tab";
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

type Props = {
  dialogState: ReturnUseDialogState;
  onSelected?: (data: SelectNormalizedDataSet) => void;
};

export const DialogImportNormalizedDataset = ({
  dialogState,
  onSelected,
}: Props): JSX.Element => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedDataSet, setSelectedDataSet] =
    useState<SelectNormalizedDataSet | null>(null);

  const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = dialogState;

  const { data: fetchedDatasets } = useFetchNormalizedDatasets();
  const datasets = fetchedDatasets ?? [];

  const handleClick = (): void => {
    if (selectedDataSet !== null) {
      // const dataset = datasets[selectedDatasetIndex];
      onSelected?.(selectedDataSet);
      setIsDialogOpen(false);
    }
  };

  const handleTabChange = (_: SelectTabEvent, data: SelectTabData): void => {
    setSelectedTab(data.value as number);
    setSelectedDataSet(null);
  };
  return (
    <Dialog
      onOpenChange={(_, { open }) => setIsDialogOpen(open)}
      open={isDialogOpen}
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
            ファイルをインポート
          </DialogTitle>
          <DialogContent padding={false}>
            <TabList
              className={styles.tabList}
              onTabSelect={handleTabChange}
              selectedValue={selectedTab}
            >
              <Tab className={styles.tab} value={0}>
                データセットから選択
              </Tab>
              {/* <Tab className={styles.tab} value={1}>
                新規アップロード
              </Tab> */}
            </TabList>

            {selectedTab === 0 && (
              <>
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
                  {datasets.length > 0 ? (
                    <TableBody className={styles.tableBody}>
                      {datasets.map((dataset) => (
                        <TableRow
                          key={dataset.id}
                          className={mergeClasses(
                            styles.datasetTable,
                            selectedDataSet?.id === dataset.id
                              ? styles.selectedDatasetTable
                              : styles.borderBottom,
                          )}
                          onClick={() => setSelectedDataSet(dataset)}
                        >
                          <TableCell
                            className={mergeClasses(
                              styles.datasetCell,
                              styles.dataName,
                            )}
                          >
                            {dataset.file_name}
                          </TableCell>
                          <TableCell className={styles.datasetCell}>
                            {dataset.created_at}
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

            {selectedTab === 1 && (
              <div className={styles.uploadWrap}>
                <FileUploader
                  onUpload={() => {
                    return;
                  }}
                />
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              className={
                selectedTab === 0 && selectedDataSet === null
                  ? styles.disabledButton
                  : ""
              }
              disabled={selectedTab === 0 && selectedDataSet === null}
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
