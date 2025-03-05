import {
  Card,
  makeStyles,
  mergeClasses,
  Option,
  Radio,
  RadioGroup,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Delete16Regular } from "@fluentui/react-icons";
import { type UseFormReturn } from "react-hook-form";
import { type z } from "zod";
import { THEME_COLORS } from "../config/theme-colors";
import { type SelectRawDataSet } from "../schema";
import { LanguageMap } from "../metadata";
import { useDialogState } from "../hooks/use-dialog-state";
import { useFetchDatasetColumns } from "../hooks/use-fetch-dataset-columns";
import { type PreprocessParameters } from "../@types/job-parameters";
import { useFetchDatasetWithFilePath } from "../hooks/use-fetch-dataset-with-file-path";
import { lang } from "../lang";
import { type schema } from "../hooks/use-form-normalization";
import { BUILDING_FILE_TYPES } from "../config/file-types";
import { Dropdown } from "./ui/dropdown";
import { Field } from "./ui/field";
import { DialogImportDataset } from "./dialog-import-dataset";
import { TextWithTooltip } from "./ui/text-with-tooltip";
import { Select } from "./ui/select";

const useStyles = makeStyles({
  fileSelectorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "200px",
    height: "160px",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: "5px",
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground3,
    gap: `${tokens.spacingVerticalS} 0`,
  },
  fieldContainer: {
    display: "flex",
    gap: "16px",
  },
  dropdownContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gridAutoRows: "60px",
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  dropdown: {
    height: "36px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fieldInner: {
    display: "grid",
    gap: "4px",
  },
});

interface Value {
  id: PreprocessParameters["data"]["resident_registry"]["id"]; // ひとまずresident_registryの型を使う
  path: PreprocessParameters["data"]["resident_registry"]["path"] | undefined;
  columns?: Record<string, string | undefined>; // 国勢調査データにカラムがないためoptionalを指定する
}

type FormType = z.infer<typeof schema>;

interface Props {
  value: Value;
  dataKey: keyof typeof lang.components.normalizationData;
  appearance?: "default" | "large";
  onChange: (value: Value) => void;
  form?: UseFormReturn<FormType>;
}

export const FormDataset = ({
  value,
  dataKey,
  appearance,
  onChange,
  form,
}: Props): JSX.Element => {
  const styles = useStyles();
  const dialogState = useDialogState();
  const { data: dataSetColumns } = useFetchDatasetColumns({
    filename: value?.path,
  });
  const [isUpdateColumns, setIsUpdateColumns] = useState(false);

  useEffect(
    // ファイルが選択されたらドロップダウンの値を更新する
    function updateColumns() {
      if (!isUpdateColumns) return;
      if (!dataSetColumns || dataSetColumns.length === 0 || !value.columns)
        return;

      // 最初の要素をドロップダウンのdefault valueに設定する
      const [firstItem] = dataSetColumns;
      const columnEntries = Object.entries(value.columns);
      const newColumns = Object.fromEntries(
        columnEntries.map(([key]) => [key, firstItem]),
      );

      onChange({
        ...value,
        columns: newColumns,
      });
      setIsUpdateColumns(false);
    },

    [dataSetColumns, isUpdateColumns, onChange, value],
  );

  const datasetInfo = lang.components.normalizationData[dataKey];
  const datasetLabel = datasetInfo.label;
  const datasetDescription = datasetInfo.description || "";

  /**
   * buildingPolygon
   */
  const isBuildingPolygon = dataKey === "buildingPolygon";
  const buildingPolygoninputFileType = form?.watch(
    "data.building_polygon.input_file_type",
  );

  return (
    <Card>
      <p>
        <TextWithTooltip
          textNode={datasetLabel}
          tooltipContent={datasetDescription}
        />
      </p>
      <div className={styles.fieldContainer}>
        <div
          className={styles.fileSelectorContainer}
          onClick={() => {
            dialogState.setIsOpen(true);
          }}
          role="button"
        >
          <SelectedDataSetView
            filePath={value.path}
            onDelete={() => {
              onChange({
                ...value,
                path: undefined,
                columns: Object.fromEntries(
                  Object.keys(value.columns ?? {}).map((key) => [
                    key,
                    undefined,
                  ]),
                ),
              });
            }}
          />
        </div>
        <div
          // FormDatasetが横長の場合のスタイルだしわけ
          className={mergeClasses(
            styles.fieldInner,
            appearance === "large" && styles.dropdownContainer,
          )}
        >
          {isBuildingPolygon && (
            <>
              <Field label="データの種類">
                <RadioGroup>
                  <Radio
                    label="PLATEAUデータ"
                    value="plateau"
                    {...form?.register("data.building_polygon.data_type")}
                  />
                  <Radio
                    label="家屋現況図"
                    value="house_condition_report"
                    {...form?.register("data.building_polygon.data_type")}
                  />
                </RadioGroup>
              </Field>
              <Field label="ファイル形式">
                <Select
                  {...form?.register("data.building_polygon.input_file_type")}
                >
                  {BUILDING_FILE_TYPES.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          {value.columns
            ? Object.entries(value.columns).map(([key]) => {
                const noColumns =
                  !dataSetColumns || dataSetColumns.length === 0;

                const noCSV =
                  isBuildingPolygon && buildingPolygoninputFileType !== "csv";

                return (
                  <Field
                    key={key}
                    className={styles.field}
                    label={
                      <TextWithTooltip
                        textNode={
                          LanguageMap.NORMALIZATION_PARAMETER_LABEL[
                            key as keyof typeof LanguageMap.NORMALIZATION_PARAMETER_LABEL
                          ] + "カラム"
                        }
                        tooltipContent={
                          lang.components.normalizationParameters[
                            key as keyof typeof lang.components.normalizationParameters
                          ]?.description || ""
                        }
                      />
                    }
                  >
                    <Dropdown
                      className={styles.dropdown}
                      disabled={noColumns || noCSV}
                      onOptionSelect={(_, data) => {
                        onChange({
                          ...value,
                          columns: {
                            ...value.columns,
                            [key]: data.optionValue,
                          },
                        });
                      }}
                      selectedOptions={[value.columns?.[key] ?? ""]}
                      value={value.columns?.[key] ?? ""}
                    >
                      {dataSetColumns?.map((column) => (
                        <Option key={column} text={column} value={column}>
                          {column}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                );
              })
            : null}
        </div>
      </div>
      <DialogImportDataset
        dialogState={dialogState}
        onSubmit={(data) => {
          onChange({
            ...value,
            id: data.id,
            path: data?.file_path,
          });
          setIsUpdateColumns(true);
        }}
      />
    </Card>
  );
};

const selectedDataSetViewStyles = makeStyles({
  symbol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: `${tokens.spacingVerticalS} 0`,
  },
  roundedLabel: {
    backgroundColor: THEME_COLORS.primary,
    borderRadius: "14px",
    color: "#fff",
    fontWeight: tokens.fontWeightBold,
    lineHeight: "28px",
    padding: `0 ${tokens.spacingHorizontalXXL}`,
  },
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: `${tokens.spacingVerticalS} 0`,
    position: "relative",
    height: "100%",
  },
  deleteButton: {
    color: "#c4314b", // token内に同色が存在しないためハードコード
    cursor: "pointer",
    fontSize: tokens.fontSizeBase200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingHorizontalXS,
    background: "none",
    border: "none",
  },
  selectedDataSetFilePath: {
    color: THEME_COLORS.primary,
    textDecoration: "underline",
    textAlign: "center",
  },
});

const SelectedDataSetView = ({
  filePath,
  onDelete,
}: {
  filePath: SelectRawDataSet["file_path"] | undefined;
  onDelete: () => void;
}): JSX.Element => {
  const styles = selectedDataSetViewStyles();
  const { data } = useFetchDatasetWithFilePath({
    type: "raw",
    filePath,
  });

  if (!data) {
    return (
      <div className={styles.symbol}>
        <img alt="upload file" src="/file-upload-icon.svg" />
        <div className={styles.roundedLabel}>データセットを選択</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <p className={styles.selectedDataSetFilePath}>{data.file_name}</p>
      <button
        className={styles.deleteButton}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Delete16Regular />
        <span>削除</span>
      </button>
    </div>
  );
};
