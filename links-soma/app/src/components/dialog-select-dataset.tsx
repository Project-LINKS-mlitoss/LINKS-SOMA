import {
  Dialog,
  tokens,
  makeStyles,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  mergeClasses,
  typographyStyles,
  DialogTrigger,
  Checkbox,
} from "@fluentui/react-components";
import {
  ArrowSortRegular,
  DismissFilled,
  ComposeRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { Link } from "react-router-dom";
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { Button } from "./ui/button";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { DialogActions } from "./ui/dialog-actions";
import { Input } from "./ui/input";

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
  noDataset: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
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
  linkToModel: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: "#6264A7",
    textDecoration: "underline",
    ...typographyStyles.subtitle2,
    ":hover": { cursor: "pointer" },
  },
  dialogLinkToModel: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: "#6264A7",
    textDecoration: "underline",
    ...typographyStyles.body1,
    ":hover": { cursor: "pointer" },
  },
  largeBoldIcon: {
    fontSize: "20px",
  },
  dialogActions: {
    display: "flex",
    width: "100%",
    gridColumnStart: 1,
    justifyContent: "space-between",
  },
  dialogAction: {
    display: "flex",
    gap: tokens.spacingHorizontalXL,
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
});

type Dataset = {
  id: number;
  file_name: string | null;
  created_at: string;
};

type Props<T extends Dataset> = {
  dialogState: ReturnUseDialogState;
  isModel?: boolean;
  onSelected?: (data: T[]) => void;
  useFetchDatasets: () => { data: T[] | undefined };
  title: string;
  placeholder: string;
  emptyMessage: string;
  multiple?: boolean;
};

export function DialogSelectDataset<T extends Dataset>({
  dialogState,
  isModel = false,
  onSelected,
  useFetchDatasets,
  title,
  placeholder,
  emptyMessage,
  multiple = false,
}: Props<T>): JSX.Element {
  const styles = useStyles();
  const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = dialogState;

  const { data: datasets } = useFetchDatasets();
  const dataItems = datasets ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDataSets, setSelectedDataSets] = useState<T[]>([]);

  const filteredDataItems = dataItems.filter((dataset) =>
    dataset.file_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRowClick = (dataset: T, newState?: boolean): void => {
    if (multiple) {
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
    } else {
      // 単数選択モード: 常にクリックした行のみ選択
      setSelectedDataSets([dataset]);
    }
  };

  const handleClick = (): void => {
    if (selectedDataSets.length > 0) {
      onSelected?.(selectedDataSets);
      setIsDialogOpen(false);
      setSearchQuery("");
      setSelectedDataSets([]);
    }
  };

  return (
    <Dialog
      onOpenChange={(_, { open }) => {
        setIsDialogOpen(open);
        if (!open) {
          setSelectedDataSets([]);
          setSearchQuery("");
        }
      }}
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
            {title}
          </DialogTitle>
          <DialogContent padding={false}>
            <div className={styles.searchBox}>
              <Input
                className={styles.input}
                contentBefore={<SearchRegular />}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={placeholder}
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
                    return (
                      <TableRow
                        key={dataset.id}
                        className={mergeClasses(
                          styles.datasetTable,
                          isSelected
                            ? styles.selectedDatasetTable
                            : styles.borderBottom,
                        )}
                        onClick={() => handleRowClick(dataset)}
                      >
                        <TableCell
                          className={mergeClasses(
                            styles.datasetCell,
                            styles.dataName,
                          )}
                        >
                          {multiple && (
                            <Checkbox
                              checked={isSelected}
                              className={styles.checkbox}
                              onChange={(ev, data) => {
                                ev.stopPropagation();
                                const checkedValue =
                                  data.checked === "mixed"
                                    ? false
                                    : data.checked;
                                handleRowClick(dataset, checkedValue);
                              }}
                            />
                          )}
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
                  <span className={styles.noDataset}>{emptyMessage}</span>
                  {isModel && (
                    <Link className={styles.dialogLinkToModel} to={"/model"}>
                      モデルを作成
                      <ComposeRegular className={styles.largeBoldIcon} />
                    </Link>
                  )}
                </div>
              )}
            </Table>
          </DialogContent>
          <DialogActions
            className={isModel ? styles.dialogActions : styles.dialogAction}
          >
            {isModel && (
              <Link className={styles.linkToModel} to={"/model"}>
                モデルを作成
                <ComposeRegular className={styles.largeBoldIcon} />
              </Link>
            )}
            <Button
              appearance="primary"
              className={
                selectedDataSets.length === 0
                  ? styles.disabledButton
                  : undefined
              }
              disabled={selectedDataSets.length === 0}
              onClick={handleClick}
            >
              データを決定
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
