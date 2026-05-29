import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
  tokens,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  useTableFeatures,
  useTableSelection,
  createTableColumn,
  TableSelectionCell,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowDownloadRegular,
  MoreVerticalRegular,
} from "@fluentui/react-icons";
import { type MouseEvent, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/button";
import { type SelectRawDataSet } from "../../../../db/schema";
import { useFetchRawDatasets } from "../../hooks/use-fetch-raw-datasets";
import { formatDate } from "../../../../shared/utils/format-date";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { downloadDataSetFile } from "../../../../shared/utils/download-data-set-file";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { handleUpload, handleUploadButtonClick } from "../../pages/_util";
import { DataPreviewDialog } from "./data-preview-dialog";
import { EditNameDialog } from "./edit-name-dialog";
import { DeleteDataSetRowDialog } from "./delete-dataset-row-dialog";
import { DeleteRowsDialog } from "./delete-rows-dialog";
import { RawDataPreviewTable } from "./raw-data-preview-table";

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
  checkboxTh: {
    width: "44px",
  },
  menuItemButton: {
    justifyContent: "flex-start",
    padding: 0,
    fontWeight: "normal",
  },
  input: {
    width: "100%",
  },
  dataPreviewTableContainer: {
    marginTop: tokens.spacingVerticalS,
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
  uploadButton: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  iconButton: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    "&:hover, &:active, &:focus, &:focus-within": {
      border: `1px solid ${tokens.colorNeutralStroke1Selected}`,
    },
  },
  datasetList: {
    marginTop: tokens.spacingVerticalL,
  },
});

export function RawDataSetTable(): JSX.Element {
  const styles = useStyles();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteSelectedItems = async (): Promise<void> => {
    await Promise.all(
      selectedIds.map((id) =>
        window.ipcRenderer.invoke("deleteRawDataset", {
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
          component: "RawDatasetTable",
        });
      });
  };

  const columns = [
    createTableColumn<SelectRawDataSet>({ columnId: "name" }),
    createTableColumn<SelectRawDataSet>({ columnId: "date" }),
  ];
  const { data, mutate } = useFetchRawDatasets();

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

  const handleDelete = async (id: SelectRawDataSet["id"]): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteRawDataset", { id });
      await mutate();
      setSelectedIds((prev) => prev.filter((prevId) => prevId !== id));
    } catch (error) {
      rendererLogger.error("Single delete operation failed", error, {
        datasetId: id,
        component: "RawDatasetTable",
      });
    }
  };

  const allSelected = data?.length === selectedIds.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < (data?.length || 0);

  return (
    <>
      <div className={styles.actions}>
        <div>
          <input
            ref={fileInputRef}
            multiple
            onChange={async (e) => handleUpload(e, "raw").then(() => mutate())}
            style={{ display: "none" }}
            type="file"
          />
          <Button
            appearance="outline"
            className={styles.uploadButton}
            onClick={() =>
              handleUploadButtonClick({
                fileInputRef,
              })
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
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

interface RowProps {
  item: SelectRawDataSet;
  selected: boolean;
  appearance: "brand" | "none";
  onClick: (e: MouseEvent) => void;
  onDelete: () => void;
}

function Row({
  item,
  selected,
  onClick,
  appearance,
  onDelete,
}: RowProps): JSX.Element {
  const styles = useStyles();
  const dataPreviewDialogState = useDialogState(false);

  const handleDownload = async (): Promise<void> => {
    try {
      const data = await window.ipcRenderer.invoke("selectRawDataset", {
        id: item.id,
      });
      if (!data) return;
      const buffer = await window.ipcRenderer.invoke("readDatasetFile", {
        fileName: data.file_path,
      });
      // 実ファイルの拡張子を取得し、ファイル名に拡張子がない場合は補完する
      const fileName = data.file_name || "";
      const filePath = data.file_path || "";
      const extMatch = filePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : "";
      const downloadName =
        ext && !fileName.toLowerCase().endsWith(ext.toLowerCase())
          ? `${fileName}${ext}`
          : fileName;
      void downloadDataSetFile(buffer, downloadName);
    } catch (error) {
      rendererLogger.error("Dataset download failed", error, {
        datasetId: item.id,
        fileName: item.file_name,
        component: "RawDatasetTable",
      });
      alert("ダウンロードに失敗しました。");
    }
  };

  return (
    <TableRow
      key={item.id}
      appearance={appearance}
      aria-selected={selected}
      onClick={onClick}
    >
      <TableSelectionCell
        checkboxIndicator={{ "aria-label": "Select row" }}
        checked={selected}
      />
      <TableCell>
        <DataPreviewDialog
          content={<RawDataPreviewTable id={item.id} />}
          datasetName={item.file_name}
          dialogState={dataPreviewDialogState}
        />
      </TableCell>
      <TableCell>{formatDate(item.updated_at, "YYYY/MM/DD HH:mm")}</TableCell>
      <TableCell className={styles.cellActions}>
        <Button
          appearance="subtle"
          aria-label="ダウンロード"
          icon={<ArrowDownloadRegular />}
          onClick={(e) => {
            e.stopPropagation();
            void handleDownload();
          }}
        />
        <RowMenu item={item} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}

function RowMenu({
  item,
  onDelete,
}: {
  item: SelectRawDataSet;
  onDelete: () => void;
}): JSX.Element {
  const editNameDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);
  const { mutate } = useFetchRawDatasets();
  // ファイル名と拡張子に分割
  // 拡張子ファイルを扱うのはシードデータのみっぽいので、いったんここだけ対応する
  const { name, ext } = (() => {
    if (!item.file_name) {
      return { name: "", ext: "" };
    }
    if (item.file_name.indexOf(".") === -1) {
      return { name: item.file_name, ext: "" };
    }
    const [name, ext] = item.file_name.split(".");
    return { name, ext };
  })();

  const handleEditName = async (
    newFileName: SelectRawDataSet["file_name"],
  ): Promise<void> => {
    const fullFileName = newFileName + (ext ? `.${ext}` : "");
    await window.ipcRenderer.invoke("updateRawDataset", {
      id: item.id,
      fileName: fullFileName,
    });
    void mutate();
  };

  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            aria-label="詳細メニュー"
            icon={<MoreVerticalRegular />}
            onClick={(e) => e.stopPropagation()}
          />
        </MenuTrigger>
        <MenuPopover onClick={(e) => e.stopPropagation()}>
          <MenuList>
            <MenuItem
              onClick={() => {
                editNameDialogState.setIsOpen(true);
              }}
            >
              データ名の編集
            </MenuItem>
            <MenuItem
              onClick={() => {
                deleteDialogState.setIsOpen(true);
              }}
            >
              削除
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <EditNameDialog
        dialogState={editNameDialogState}
        initialName={name}
        onSubmit={handleEditName}
      />
      <DeleteDataSetRowDialog
        dialogState={deleteDialogState}
        fileName={item.file_name}
        onDelete={onDelete}
      />
    </>
  );
}
