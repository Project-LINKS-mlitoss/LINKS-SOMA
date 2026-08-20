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
import { THEME_COLORS } from "../../../shared/config/theme-colors";
import { type SelectRawDataSet } from "../../../db/schema";
import { useDialogState } from "../../../shared/hooks/use-dialog-state";
import { useFetchDatasetColumns } from "../../dataset/hooks/use-fetch-dataset-columns";
import { useFetchDatasetColumnValues } from "../../dataset/hooks/use-fetch-dataset-column-values";
import { type PreprocessParameters } from "../../../shared/types/job-parameters";
import { useFetchDatasetWithFilePath } from "../../dataset/hooks/use-fetch-dataset-with-file-path";
import { lang } from "../../../shared/config/lang";
import { getNormalizationDatasetInfo } from "../util/extract-dataset-columns-from-schema";
import { type schema } from "../hooks/use-form-normalization";
import {
  INPUT_FILE_TYPES,
  PLATEAU_FILE_TYPES,
} from "../../../shared/config/file-types";
import { Dropdown, Field, Select } from "../../../shared/components/ui";
import { DialogImportDataset } from "./dialog-import-dataset";
import { DialogBuildingTypeSelection } from "./dialog-building-type-selection";

const useStyles = makeStyles({
  // カード自身の幅を基準にレスポンシブ切替するためのコンテナ。
  // ビューポート幅(@media)ではなく実際のカード幅で列数を決めるため。
  card: {
    containerType: "inline-size",
  },
  fileSelectorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "200px",
    height: "160px",
    // flex item は既定で縮むため、固定幅を保つには flexShrink:0 が必要
    flexShrink: 0,
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
  // NOTE: このスタイルはウィザード形式と元の単一ページフォームの両方で使用される
  // 変更時は両方の表示を確認すること
  dropdownContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    // 行高は最小60pxで、ラベル折り返し等で内容が増えたら伸びる（固定高だと重なる）
    gridAutoRows: "minmax(60px, auto)",
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    // フレックス行の残り幅いっぱいに広がり、各列を等幅で満たす（無いと列が中身幅まで縮む）
    flexGrow: 1,
    minWidth: 0,
    // 列数の切替閾値はカード実幅基準。実環境で調整するならこの値を動かす
    "@container (max-width: 800px)": {
      gridTemplateColumns: "1fr",
    },
  },
  dropdown: {
    height: "36px",
    // Fluent 既定の min-width:250px を解除し、グリッドのセル幅に追従させる。
    // これがないと狭い列で Dropdown がはみ出して隣の列と重なる。
    minWidth: 0,
    width: "100%",
  },
  buildingTypeDropdown: {
    maxWidth: "250px",
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
  input_file_type?: string;
  data_type?: string;
  residential_values?: string[];
}

type FormType = z.infer<typeof schema>;

interface Props {
  value: Value;
  dataKey: keyof typeof lang.components.normalizationData;
  schemaKey: keyof FormType["data"];
  appearance?: "default" | "large";
  onChange: (value: Value) => void;
  form?: UseFormReturn<FormType>;
}

export const FormDataset = ({
  value,
  dataKey,
  schemaKey,
  appearance,
  onChange,
  form: _form,
}: Props): JSX.Element => {
  const styles = useStyles();
  const dialogState = useDialogState();
  const { data: dataSetColumns } = useFetchDatasetColumns({
    filename: value?.path,
  });
  const datasetInfo = lang.components.normalizationData[dataKey];
  const datasetLabel = datasetInfo.label;

  const noColumns = !dataSetColumns || dataSetColumns.length === 0;

  /** 家屋種別 */
  const [residentialValueOptions, setResidentialValueOptions] = useState<
    string[] | false | "empty"
  >(false);

  const isBuildingPolygon = dataKey === "buildingPolygon";

  // building_type_determination の場合、input_file_type が csv 以外なら住所カラム選択不可
  const isBuildingTypeDetermination =
    schemaKey === "building_type_determination";
  // input_file_typeがundefinedの場合はデフォルトの"csv"として扱う
  const noCSV =
    isBuildingTypeDetermination && (value?.input_file_type ?? "csv") !== "csv";

  // building_type カラムが選択されたときにその値を取得
  const buildingTypeColumn = value?.columns?.building_type;
  const {
    data: buildingTypeValues,
    isValidating: isBuildingTypeValuesLoading,
  } = useFetchDatasetColumnValues({
    filename: value?.path,
    columnName: buildingTypeColumn,
  });

  // buildingTypeValues が更新されたら residentialValueOptions を更新
  useEffect(() => {
    if (schemaKey !== "building_type_determination") return;
    if (isBuildingTypeValuesLoading) return;

    if (buildingTypeValues) {
      setResidentialValueOptions(buildingTypeValues);
    } else if (buildingTypeColumn) {
      // カラムは選択されているが選択肢がない場合
      setResidentialValueOptions("empty");
    } else {
      // カラムが選択されていない場合（ファイル削除時など）
      setResidentialValueOptions(false);
    }
  }, [
    buildingTypeValues,
    buildingTypeColumn,
    isBuildingTypeValuesLoading,
    schemaKey,
  ]);

  return (
    <Card className={styles.card}>
      <span>{datasetLabel}</span>
      <div className={styles.fieldContainer}>
        <div
          className={styles.fileSelectorContainer}
          onClick={() => {
            dialogState.setIsOpen(true);
          }}
          role="button"
        >
          <SelectedDataSetView
            filePath={value?.path}
            onDelete={() => {
              onChange({
                ...value,
                path: "",
                columns: Object.fromEntries(
                  Object.keys(value?.columns ?? {}).map((key) => [key, ""]),
                ),
                residential_values: [],
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
            <Field label="データの種類">
              <RadioGroup
                onChange={(_, data) => {
                  onChange({
                    ...value,
                    data_type: data.value,
                  });
                }}
                value={value?.data_type ?? "plateau"}
              >
                <Radio label="PLATEAUデータ" value="plateau" />
                <Radio label="PLATEAUデータ以外" value="others" />
              </RadioGroup>
            </Field>
          )}

          {isBuildingPolygon && (
            <Field label="ファイル形式">
              <Select
                onChange={(_, data) => {
                  onChange({
                    ...value,
                    input_file_type: data.value,
                  });
                }}
                value={value?.input_file_type ?? "geopackage"}
              >
                {PLATEAU_FILE_TYPES.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {schemaKey === "building_type_determination" && (
            <Field label="ファイル形式">
              <Select
                onChange={(_, data) => {
                  onChange({
                    ...value,
                    input_file_type: data.value,
                  });
                }}
                value={value?.input_file_type ?? "csv"}
              >
                {INPUT_FILE_TYPES.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {(() => {
            // スキーマから動的にカラム情報を取得
            const datasetInfo = getNormalizationDatasetInfo(schemaKey);
            if (!datasetInfo || !datasetInfo.hasColumns) return null;

            return datasetInfo.columns.map((columnInfo) => {
              return (
                <Field
                  key={columnInfo.key}
                  className={styles.field}
                  label={columnInfo.label + "カラム"}
                >
                  <Dropdown
                    className={styles.dropdown}
                    disabled={
                      noColumns || (columnInfo.key === "address" && noCSV)
                    }
                    onOptionSelect={(_, data) => {
                      onChange({
                        ...value,
                        columns: {
                          ...value?.columns,
                          [columnInfo.key]: data.optionValue,
                        },
                        // building_typeカラムが変更された場合、residential_valuesをクリア
                        // （新しいカラムの値に依存するため）
                        ...(columnInfo.key === "building_type" && {
                          residential_values: [],
                        }),
                      });
                    }}
                    selectedOptions={[value?.columns?.[columnInfo.key] ?? ""]}
                    value={value?.columns?.[columnInfo.key] ?? ""}
                  >
                    {dataSetColumns?.map((column) => (
                      <Option key={column} text={column} value={column}>
                        {column}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              );
            });
          })()}

          {schemaKey === "building_type_determination" && (
            <Field
              label={
                lang.components.normalizationParameters.building_type_values
                  .label
              }
              style={{
                marginLeft: tokens.spacingHorizontalL,
              }}
            >
              <DialogBuildingTypeSelection
                disabled={
                  !residentialValueOptions ||
                  residentialValueOptions === "empty"
                }
                onChange={(values) => {
                  onChange({
                    ...value,
                    residential_values: values,
                  });
                }}
                options={
                  residentialValueOptions && residentialValueOptions !== "empty"
                    ? residentialValueOptions
                    : []
                }
                selectedValues={value?.residential_values ?? []}
              />
            </Field>
          )}
        </div>
      </div>
      <DialogImportDataset
        dialogState={dialogState}
        onSubmit={(data) => {
          onChange({
            ...value,
            id: data.id,
            path: data?.file_path,
            residential_values: [],
          });
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
    // 狭幅で「デ／ー／タ…」と1文字ずつ折り返すのを防ぐ
    whiteSpace: "nowrap",
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
    wordBreak: "break-all",
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
