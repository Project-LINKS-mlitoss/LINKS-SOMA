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
  Dialog,
  Field,
  Radio,
  RadioGroup,
  DialogTrigger,
  Option,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  MoreVerticalRegular,
} from "@fluentui/react-icons";
import {
  type Dispatch,
  type SetStateAction,
  type MouseEvent,
  useState,
} from "react";
import { Button } from "../ui/button";
import { useFetchDataSetResults } from "../../hooks/use-fetch-data-set-results";
import { type SelectDataSetResult } from "../../schema";
import { formatDate } from "../../utils/format-date";
import { useDialogState } from "../../hooks/use-dialog-state";
import { DialogBody } from "../ui/dialog-body";
import { DialogTitle } from "../ui/dialog-title";
import { DialogContent } from "../ui/dialog-content";
import { DialogActions } from "../ui/dialog-actions";
import { DialogSurface } from "../ui/dialog-surface";
import {
  type ResultDataSetsResponse,
  useFetchResultDataSetsWithPagination,
} from "../../hooks/use-fetch-result-data-sets-with-pagination";
import { usePagination } from "../../hooks/use-pagination";
import { Pagination } from "../ui/pagination";
import { Dropdown } from "../ui/dropdown";
import { OUTPUT_COORDINATES } from "../bi/tile-result-view";
import { OUTPUT_FILE_TYPES } from "../../config/file-types";
import { useFetchReferenceDates } from "../../hooks/use-fetch-reference-dates";
import { type ReferenceDate } from "../../ipc-main-listeners/select-reference-dates";
import { DialogExportMessage } from "../dialog-export-message";
import { DeleteDataSetRowDialog } from "./delete-dataset-row-dialog";
import { EditNameDialog } from "./edit-name-dialog";
import { DataPreviewDialog } from "./data-preview-dialog";
import { DataPreviewTable } from "./data-preview-table";
import { ResultDataSetMetadata } from "./result-dataset-metadata";

const useStyles = makeStyles({
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalM,
  },
  datasetButton: {
    padding: 0,
    justifyContent: "flex-start",
    color: tokens.colorBrandForeground1,
    textDecoration: "underline",
    borderRadius: 0,
    textAlign: "left",
    "&:hover": {
      textDecoration: "none",
    },
  },
  dataPreviewTableContainer: {
    marginTop: tokens.spacingVerticalS,
  },
  radioGroup: {
    marginTop: tokens.spacingVerticalM,
    marginLeft: "-8px",
  },
  dropdown: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    "& > label": {
      fontSize: "12px",
    },
  },
});

export type ResultDataSetUnit = "building" | "area";

type Props = {
  selectedIds: SelectDataSetResult["id"][];
  onSelectionChange: Dispatch<SetStateAction<SelectDataSetResult["id"][]>>;
};

export function ResultDataSetTable({
  onSelectionChange,
  selectedIds,
}: Props): JSX.Element {
  const styles = useStyles();
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
        onSelectionChange((prev) =>
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
    onSelectionChange((prev) =>
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
      onSelectionChange((prev) => prev.filter((prevId) => prevId !== id));
    } catch (error) {
      console.error("Delete operation failed:", error);
    }
  };

  const allSelected = data?.length === selectedIds.length;
  const someSelected =
    selectedIds.length > 0 && selectedIds.length < (data?.length || 0);

  return (
    <Table>
      <TableHeader className={styles.tableHeader}>
        <TableRow>
          <TableSelectionCell
            checkboxIndicator={{ "aria-label": "Select all rows" }}
            checked={allSelected ? true : someSelected ? "mixed" : false}
            onClick={handleToggleAll}
          />
          <TableHeaderCell>データセット名</TableHeaderCell>
          <TableHeaderCell>アップロード日</TableHeaderCell>
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
  );
}

interface RowProps {
  item: SelectDataSetResult;
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
  const exportDialogState = useDialogState(false);
  const [selectedUnit, setSelectedUnit] =
    useState<ResultDataSetUnit>("building");
  const pagination = usePagination(50);
  const { data } = useFetchResultDataSetsWithPagination({
    dataSetResultId: item.id,
    type: selectedUnit,
    page: pagination.page,
    limitPerPage: pagination.limitPerPage,
  });
  const { data: referenceDates, isLoading: isLoadingReferenceDates } =
    useFetchReferenceDates({ dataSetResultId: item.id });

  return (
    <>
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
          <SelectUnitDialog
            datasetName={item.title}
            onChange={(unit) => setSelectedUnit(unit)}
            onSubmit={() => {
              pagination.handlePageChange(1);
              pagination.handleLimitPerPageChange(50);
              dataPreviewDialogState.setIsOpen(true);
            }}
          />
          <DataPreviewDialog
            content={
              <div>
                <Pagination {...pagination} />
                <div className={styles.dataPreviewTableContainer}>
                  <DataPreviewTable data={parseResultDataSets(data)} />
                </div>
              </div>
            }
            datasetName={item.title}
            dialogState={dataPreviewDialogState}
            hideTrigger
          />
        </TableCell>
        <TableCell>{formatDate(item.updated_at, "YYYY/MM/DD")}</TableCell>
        <TableCell className={styles.actions}>
          {isLoadingReferenceDates ? null : (
            <DownloadDialog
              dataSetResultId={item.id}
              onSubmit={() => exportDialogState.setIsOpen(true)}
              referenceDates={referenceDates || []}
            />
          )}
          <DialogExportMessage dialogState={exportDialogState} />
          <RowMenu item={item} onDelete={onDelete} />
        </TableCell>
      </TableRow>
    </>
  );
}

function DownloadDialog({
  referenceDates,
  dataSetResultId,
  onSubmit,
}: {
  referenceDates: ReferenceDate[];
  dataSetResultId: SelectDataSetResult["id"];
  onSubmit: () => void;
}): JSX.Element {
  const styles = useStyles();
  const { isOpen, setIsOpen } = useDialogState(false);
  const [selectedUnit, setSelectedUnit] =
    useState<ResultDataSetUnit>("building");
  const [selectedFileType, setSelectedFileType] = useState(
    OUTPUT_FILE_TYPES[0].type,
  );
  const [selectedCoordinate, setSelectedCoordinate] = useState(
    OUTPUT_COORDINATES[0].code,
  );
  const [selectedReferenceDate, setSelectedReferenceDate] = useState<string>(
    referenceDates[0],
  );

  const handleDownload = async (): Promise<void> => {
    await window.ipcRenderer
      .invoke("exportData", {
        data: {
          parameterType: "export",
          data_set_results_id: dataSetResultId,
          target_unit: selectedUnit,
          output_file_type: selectedFileType,
          output_coordinate: selectedCoordinate,
          reference_date: selectedReferenceDate,
        },
      })
      .then(onSubmit);
  };

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          aria-label="ダウンロード"
          icon={<ArrowDownloadRegular />}
          onClick={(e) => e.stopPropagation()}
        />
      </DialogTrigger>
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogBody>
          <DialogTitle>データのダウンロード</DialogTitle>
          <DialogContent>
            <div>
              <p>
                空き家推定結果データは以下の2つのデータが含まれます。
                どちらか選択してください。
              </p>
              <Field className={styles.radioGroup}>
                <RadioGroup
                  defaultValue={selectedUnit}
                  onChange={(_, data) =>
                    setSelectedUnit(data.value as ResultDataSetUnit)
                  }
                >
                  <Radio label="建物単位" value="building" />
                  <Radio label="地域単位" value="area" />
                </RadioGroup>
              </Field>
            </div>

            <div className={styles.dropdown}>
              <label id="output-file-type">出力ファイル形式</label>
              <Dropdown
                aria-labelledby="output-file-type"
                defaultSelectedOptions={[OUTPUT_FILE_TYPES[0].type]}
                defaultValue={OUTPUT_FILE_TYPES[0].name}
                onOptionSelect={(_, data) =>
                  data.optionValue && setSelectedFileType(data.optionValue)
                }
              >
                {OUTPUT_FILE_TYPES.map((option) => (
                  <Option
                    key={option.type}
                    text={option.name}
                    value={option.type}
                  >
                    {option.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.dropdown}>
              <label id="output-coordinate">出力座標系</label>
              <Dropdown
                aria-labelledby="output-coordinate"
                defaultSelectedOptions={[OUTPUT_COORDINATES[0].code]}
                defaultValue={OUTPUT_COORDINATES[0].name}
                onOptionSelect={(_, data) =>
                  data.optionValue && setSelectedCoordinate(data.optionValue)
                }
              >
                {OUTPUT_COORDINATES.map((option) => (
                  <Option
                    key={option.code}
                    text={option.name}
                    value={option.code}
                  >
                    {option.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.dropdown}>
              <label id="reference-date">推定日</label>
              {selectedReferenceDate && (
                <Dropdown
                  aria-labelledby="reference-date"
                  defaultSelectedOptions={[selectedReferenceDate]}
                  defaultValue={selectedReferenceDate}
                  onOptionSelect={(_, data) =>
                    setSelectedReferenceDate(data.optionValue || "")
                  }
                >
                  {referenceDates?.map((date) => (
                    <Option key={date} value={date}>
                      {date}
                    </Option>
                  ))}
                </Dropdown>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                void handleDownload();
                setIsOpen(false);
              }}
              size="medium"
            >
              ダウンロード準備を開始する
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SelectUnitDialog({
  datasetName,
  onChange,
  onSubmit,
}: {
  datasetName: string | null;
  onChange: (unit: ResultDataSetUnit) => void;
  onSubmit: () => void;
}): JSX.Element {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      onOpenChange={(e) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
        onChange("building");
      }}
      open={open}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="transparent"
          className={styles.datasetButton}
          onClick={(e) => e.stopPropagation()}
        >
          {datasetName}
        </Button>
      </DialogTrigger>
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogBody>
          <DialogTitle>データのプレビュー</DialogTitle>
          <DialogContent>
            <p>
              空き家推定結果データは以下の2つのデータが含まれます。
              どちらか選択してください。
            </p>
            <Field className={styles.radioGroup}>
              <RadioGroup
                defaultValue="building"
                onChange={(_, data) =>
                  onChange(data.value as "building" | "area")
                }
              >
                <Radio label="建物単位" value="building" />
                <Radio label="地域単位" value="area" />
              </RadioGroup>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                onSubmit();
                setOpen(false);
              }}
              size="medium"
            >
              プレビューを見る
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RowMenu({
  item,
  onDelete,
}: {
  item: SelectDataSetResult;
  onDelete: () => void;
}): JSX.Element {
  const editNameDialogState = useDialogState(false);
  const deleteDialogState = useDialogState(false);
  const { mutate } = useFetchDataSetResults();

  const handleEditName = async (
    newTitle: SelectDataSetResult["title"],
  ): Promise<void> => {
    await window.ipcRenderer.invoke("updateDataSetResult", {
      id: item.id,
      title: newTitle,
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
        initialName={item.title}
        onSubmit={handleEditName}
      />
      <DeleteDataSetRowDialog
        dialogState={deleteDialogState}
        fileName={item.title || ""}
        onDelete={onDelete}
      />
    </>
  );
}

/**
 * 推定結果データのカラム名を日本語名に変換したり値に単位を付与したりする。
 * @param {any} data:ResultDataSetsResponse
 * @returns {any}
 */
function parseResultDataSets(
  data: ResultDataSetsResponse,
): ResultDataSetsResponse {
  if (!data) return data;

  const parsedData = data.map((row) => {
    const newRow: NonNullable<ResultDataSetsResponse>[number] = {};

    for (const enKey in row) {
      const value = row[enKey];
      type MetadataKey = keyof typeof ResultDataSetMetadata;
      const { label: jpKey, unit } =
        ResultDataSetMetadata[enKey as MetadataKey];

      if (unit === "%") {
        if (typeof value === "string" || value === null) {
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
