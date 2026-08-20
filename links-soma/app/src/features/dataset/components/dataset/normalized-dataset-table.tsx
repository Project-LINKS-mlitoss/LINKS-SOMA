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
import { type SelectNormalizedDataSet } from "../../../../db/schema";
import { lang } from "../../../../shared/config/lang";
import { normalizationPurposeLabel } from "../../../../shared/config/normalization-purpose-label";
import { useFetchNormalizedDatasets } from "../../hooks/use-fetch-normalized-datasets";
import { formatDate } from "../../../../shared/utils/format-date";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { downloadDataSetFile } from "../../../../shared/utils/download-data-set-file";
import {
  toDisplayHeaderLine,
  translateCsvHeaderParts,
} from "../../../../shared/utils/normalized-csv-header";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { handleUpload, handleUploadButtonClick } from "../../pages/_util";
import { detectNonUtf8Files } from "../../../../shared/utils/detect-non-utf8-files";
import { EncodingWarning } from "../../../../shared/components/encoding-warning";
import { DataPreviewDialog } from "./data-preview-dialog";
import { EditNameDialog } from "./edit-name-dialog";
import { DeleteDataSetRowDialog } from "./delete-dataset-row-dialog";
import { DeleteRowsDialog } from "./delete-rows-dialog";
import { NormalizedDataPreviewTable } from "./normalized-data-preview-table";

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

export function NormalizedDataSetTable(): JSX.Element {
  const styles = useStyles();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [nonUtf8Files, setNonUtf8Files] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteSelectedItems = async (): Promise<void> => {
    await Promise.all(
      selectedIds.map((id) =>
        window.ipcRenderer.invoke("deleteNormalizedDataset", {
          id,
        }),
      ),
    )
      .then(() => {
        void mutate();
        setSelectedIds([]);
      })
      .catch((error) => {
        rendererLogger.error("Failed to delete selected normalized datasets", {
          error,
          selectedIds,
        });
      });
  };

  const columns = [
    createTableColumn<SelectNormalizedDataSet>({ columnId: "name" }),
    createTableColumn<SelectNormalizedDataSet>({ columnId: "purpose" }),
    createTableColumn<SelectNormalizedDataSet>({ columnId: "date" }),
  ];
  const { data, mutate } = useFetchNormalizedDatasets();

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

  const handleDelete = async (
    id: SelectNormalizedDataSet["id"],
  ): Promise<void> => {
    try {
      await window.ipcRenderer.invoke("deleteNormalizedDataset", { id });
      await mutate();
      setSelectedIds((prev) => prev.filter((prevId) => prevId !== id));
    } catch (error) {
      rendererLogger.error("Failed to delete normalized dataset", {
        error,
        datasetId: id,
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
            onChange={async (e) => {
              // PV-01 文字コード: 非UTF-8 を非ブロッキングで注意（保存は止めない）。
              setNonUtf8Files(await detectNonUtf8Files(e.target.files ?? []));
              await handleUpload(e, "normalization");
              await mutate();
            }}
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
      <EncodingWarning fileNames={nonUtf8Files} />
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
              <TableHeaderCell>
                {lang.components.normalizationPurpose.fieldLabel}
              </TableHeaderCell>
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
  item: SelectNormalizedDataSet;
  selected: boolean;
  appearance: "brand" | "none";
  onClick: (e: MouseEvent) => void;
  onDelete: () => void;
}

function Row({
  item,
  selected,
  appearance,
  onClick,
  onDelete,
}: RowProps): JSX.Element {
  const styles = useStyles();

  const dataPreviewDialogState = useDialogState(false);

  const handleDownload = async (): Promise<void> => {
    try {
      const data = await window.ipcRenderer.invoke("selectNormalizedDataSet", {
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
      // 一部の列名がディスク上で英語のまま残るため、渡す直前に表示名へ読み替える（ADR-0029）。
      // アップロード側（save-data-set-file.ts）の逆変換と対で維持すること
      const downloadParts =
        ext.toLowerCase() === ".csv"
          ? translateCsvHeaderParts(buffer, toDisplayHeaderLine)
          : [buffer];
      void downloadDataSetFile(downloadParts, downloadName);
    } catch (error) {
      rendererLogger.error("Failed to download normalized dataset", {
        error,
        datasetId: item.id,
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
          content={<NormalizedDataPreviewTable id={item.id} />}
          datasetName={item.file_name}
          dialogState={dataPreviewDialogState}
        />
      </TableCell>
      <TableCell>{normalizationPurposeLabel(item.purpose, true)}</TableCell>
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
  item: SelectNormalizedDataSet;
  onDelete: () => void;
}): JSX.Element {
  const editNameDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);
  const { mutate } = useFetchNormalizedDatasets();

  const handleEditName = async (
    newFileName: SelectNormalizedDataSet["file_name"],
  ): Promise<void> => {
    await window.ipcRenderer.invoke("updateNormalizedDataset", {
      id: item.id,
      fileName: newFileName,
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
        initialName={item.file_name}
        onSubmit={handleEditName}
      />
      <DeleteDataSetRowDialog
        dialogState={deleteDialogState}
        fileName={item.file_name || ""}
        onDelete={onDelete}
      />
    </>
  );
}
