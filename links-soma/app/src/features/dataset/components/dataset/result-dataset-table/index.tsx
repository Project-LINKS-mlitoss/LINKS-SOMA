import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  makeStyles,
  tokens,
  useTableFeatures,
  useTableSelection,
  createTableColumn,
  TableSelectionCell,
} from "@fluentui/react-components";
import { AddRegular } from "@fluentui/react-icons";
import { type MouseEvent, useState } from "react";
import { Button } from "../../../../../shared/components/ui/button";
import { useFetchDataSetResults } from "../../../hooks/use-fetch-data-set-results";
import { type SelectDataSetResult } from "../../../../../db/schema";
import { rendererLogger } from "../../../../../shared/utils/renderer-logger";

import { DeleteRowsDialog } from "../delete-rows-dialog";
import { DialogCreateResultDataset } from "../dialog-create-result-dataset";
import { useDialogCreateResultDataset } from "../dialog-create-result-dataset/hooks";
import { Row } from "./_row";
import { PreviewDialog } from "./_row/preview-dialog";

const useStyles = makeStyles({
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  cellActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalM,
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    "& > div": {
      display: "flex",
      alignItems: "center",
      gap: tokens.spacingHorizontalM,
    },
  },
  datasetList: {
    marginTop: tokens.spacingVerticalL,
  },
});

export function ResultDataSetTable(): JSX.Element {
  const styles = useStyles();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [title, setTitle] = useState<string | null>(null);

  const handleDeleteSelectedItems = async (): Promise<void> => {
    await Promise.all(
      selectedIds.map((id) =>
        window.ipcRenderer.invoke("deleteDataSetResult", {
          id,
        }),
      ),
    )
      .then(() => {
        void mutate();
        setSelectedIds([]);
      })
      .catch((error) => {
        rendererLogger.error("Bulk delete operation failed", error, {
          selectedCount: selectedIds.length,
          component: "ResultDatasetTable",
        });
      });
  };

  const columns = [
    createTableColumn<SelectDataSetResult>({ columnId: "name" }),
    createTableColumn<SelectDataSetResult>({ columnId: "date" }),
  ];
  const { data, mutate } = useFetchDataSetResults();

  const {
    getRows,
    selection: { toggleAllRows, toggleRow },
  } = useTableFeatures(
    {
      columns,
      items: data || [],
    },
    [
      useTableSelection({
        selectionMode: "multiselect",
        selectedItems: new Set(selectedIds.map(String)), // TableRowIdをstringに変換
      }),
    ],
  );

  const rows = getRows((row) => {
    const selected = selectedIds.includes(row.item.id);

    return {
      ...row,
      onClick: (e: MouseEvent) => {
        toggleRow(e, row.rowId);
        setSelectedIds((prev) =>
          selected
            ? prev.filter((id) => id !== row.item.id)
            : [...prev, row.item.id],
        );
      },
      selected,
      appearance: selected ? ("brand" as const) : ("none" as const),
    };
  });

  const handleToggleAll = (e: MouseEvent): void => {
    toggleAllRows(e);
    setSelectedIds((prev) =>
      prev.length === (data?.length || 0)
        ? []
        : data?.map((dataset) => dataset.id) || [],
    );
  };

  const handleDelete = async (id: SelectDataSetResult["id"]): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteDataSetResult", {
        id,
      });
      await mutate();
      setSelectedIds((prev) => prev.filter((prevId) => prevId !== id));
    } catch (error) {
      rendererLogger.error("Single delete operation failed", error, {
        datasetId: id,
        component: "ResultDatasetTable",
      });
    }
  };

  const allSelected = data?.length === selectedIds.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < (data?.length || 0);

  const dialogCreateResultDatasetState = useDialogCreateResultDataset({
    mutate,
  });

  return (
    <>
      <DialogCreateResultDataset {...dialogCreateResultDatasetState} />
      <div className={styles.actions}>
        <div>
          <Button
            onClick={() =>
              dialogCreateResultDatasetState.dialogState.setIsOpen(true)
            }
          >
            <AddRegular />
            新規アップロード
          </Button>
        </div>
        <div>
          <span>{selectedIds.length}件選択中</span>
          <DeleteRowsDialog
            disabled={selectedIds.length === 0}
            onDelete={handleDeleteSelectedItems}
          />
        </div>
      </div>
      <div className={styles.datasetList}>
        <Table>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableSelectionCell
                checkboxIndicator={{ "aria-label": "Select all rows" }}
                checked={allSelected ? true : someSelected ? "mixed" : false}
                onClick={handleToggleAll}
              />
              <TableHeaderCell>データセット名</TableHeaderCell>
              <TableHeaderCell>アップロード日時</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Row
                {...row}
                key={row.item.id}
                onDelete={() => handleDelete(row.item.id)}
                onPreviewSelect={() => setTitle(row.item.title)}
              />
            ))}
          </TableBody>
        </Table>
        <PreviewDialog title={title || ""} />
      </div>
    </>
  );
}
