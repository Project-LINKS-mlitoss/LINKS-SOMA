import {
  Body1,
  Checkbox,
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useFormContext, type UseFieldArrayReturn } from "react-hook-form";
import { useEffect, useState } from "react";
import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
  type BUILDING_DATASET_COLUMN,
  BUILDING_DATASET_COLUMN_METADATA,
  type ColumnMetadataValue,
} from "../../../../shared/config/column-metadata";
import {
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  Field,
  DialogContent,
  DialogActions,
} from "../../../../shared/components/ui";
import {
  FILTER_COLUMN_CATEGORIES,
  TILE_VIEW_CONFIG,
} from "../../config/tile-view-config";
import { type EditViewFormType } from "../../types/models/form";
import { type FormFilterConditionType } from "./form-filter-condition/use-form-filter-condition";

const useStyles = makeStyles({
  fieldset: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "400px",
    overflowY: "scroll",
  },
  dialogSurface: {
    maxWidth: "auto",
    minWidth: "auto",
  },
  categoryHeader: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    padding: `${tokens.spacingVerticalS} 0`,
    marginTop: tokens.spacingVerticalM,
    "&:first-child": {
      marginTop: 0,
    },
  },
  categoryColumns: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: `${tokens.spacingVerticalS} 0`,
  },
});

type Props = {
  appearance?: "primary" | "normal";
  filterConditionField: UseFieldArrayReturn<FormFilterConditionType>;
};

export const FilterConditionColumnSelector = ({
  appearance = "normal",
  filterConditionField,
}: Props): JSX.Element => {
  const styles = useStyles();

  const { watch } = useFormContext<EditViewFormType>();
  const unit = watch("unit");
  const style = watch("style");

  const fieldOptions = TILE_VIEW_CONFIG[style];
  // 重複削除のためArray.from(new Set())を利用
  const columnOptions = Array.from(
    new Set(
      fieldOptions.fields.flatMap((field) => {
        return field.option.flatMap((option) => {
          if (option.unit === unit) {
            return option.value;
          }
          return [];
        });
      }),
    ),
  );

  // カテゴリ別にグループ化されたカラムを生成
  const categorizedColumns = ((): {
    name: string;
    columns: (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[];
  }[] => {
    const categories = FILTER_COLUMN_CATEGORIES[unit ?? "building"];
    const categorizedInConfig = new Set<string>(
      categories.flatMap((cat) => cat.columns as string[]),
    );

    // カテゴリに含まれるカラムのみをフィルタリング（columnOptionsに存在するもののみ）
    const result: {
      name: string;
      columns: (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[];
    }[] = categories
      .map((category) => ({
        name: category.name,
        columns: (
          category.columns as (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[]
        ).filter((col) => columnOptions.includes(col)),
      }))
      .filter((category) => category.columns.length > 0);

    // カテゴリ定義にないがcolumnOptionsに存在するカラムは「その他」として追加
    const uncategorizedColumns = columnOptions.filter(
      (col) => !categorizedInConfig.has(col),
    );
    if (uncategorizedColumns.length > 0) {
      result.push({
        name: "その他",
        columns: uncategorizedColumns,
      });
    }

    return result;
  })();

  const { fields: currentFields, replace } = filterConditionField;

  /** 選択中のカラムを配列で管理 */
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentFields.map((item) => item.value.referenceColumn),
  );

  /** ダイアログを消すとselectedColumnsが空になってしまうため追加.あってるのか少し不安 */
  useEffect(() => {
    setSelectedColumns(currentFields.map((item) => item.value.referenceColumn));
  }, [currentFields]);

  const onSave = (): void => {
    if (selectedColumns.length === 0) {
      return replace([]);
    }
    /** selectedColumnsにないものは削除。あるものは既にあるかチェックしてなければ追加 */
    const newFields = currentFields.filter((field) =>
      selectedColumns.includes(field.value.referenceColumn),
    );
    selectedColumns.forEach((column) => {
      if (currentFields.find((field) => field.value.referenceColumn === column))
        return;

      // @ts-expect-error -- columnを厳密に型定義できていないので
      const columnMetadata = getMetadata({ key: column, unit });
      if (!columnMetadata) return;
      newFields.push({
        key: `filter_${(new Date().getTime() + Math.floor(10000 * Math.random())).toString(16)}`,
        type: "filter",
        // @ts-expect-error -- columnを厳密に型定義できていないので
        value: {
          referenceColumn: column,
          operation: "eq",
          value: "",
          referenceColumnType: columnMetadata.type,
        },
      });
    });

    replace(newFields);
  };

  if (unit === null) {
    return <></>;
  }

  return (
    <Dialog>
      <DialogTrigger>
        {appearance === "primary" ? (
          <Button appearance="primary" size="medium">
            フィルターを追加
          </Button>
        ) : (
          <Button appearance="outline" size="small">
            フィルターを追加
          </Button>
        )}
      </DialogTrigger>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle>カラムを選択</DialogTitle>
          <DialogContent border>
            <div className={styles.fieldset}>
              {columnOptions.length === 0 && (
                <Body1>現在の設定条件で選択可能なカラムがありません</Body1>
              )}
              {categorizedColumns.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <div className={styles.categoryHeader}>{category.name}</div>
                  <div className={styles.categoryColumns}>
                    {category.columns.map((optionKey, index) => {
                      if (!optionKey) {
                        return null;
                      }
                      const columnMetadata = getMetadata({
                        key: optionKey as
                          | BUILDING_DATASET_COLUMN
                          | AREA_DATASET_COLUMN,
                        unit,
                      });

                      if (columnMetadata === null) {
                        return null;
                      }

                      return (
                        <Field key={index}>
                          <Checkbox
                            checked={selectedColumns.includes(optionKey)}
                            label={columnMetadata.label}
                            onChange={(_ev, data) => {
                              if (data.checked) {
                                setSelectedColumns([
                                  ...selectedColumns,
                                  optionKey,
                                ]);
                              } else {
                                setSelectedColumns(
                                  selectedColumns.filter(
                                    (item) => item !== optionKey,
                                  ),
                                );
                              }
                            }}
                          />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
          <DialogActions position="end">
            <DialogTrigger>
              <Button
                appearance="primary"
                onClick={onSave}
                size="medium"
                type="button"
              >
                保存
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

/** ユーティリティ */
const isBuildingDatasetColumn = (
  key: BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN,
  unit: "building" | "area",
): key is BUILDING_DATASET_COLUMN => {
  return unit === "building";
};
const isAreaDatasetColumn = (
  key: BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN,
  unit: "building" | "area",
): key is AREA_DATASET_COLUMN => {
  return unit === "area";
};

const getMetadata = ({
  key,
  unit,
}: {
  key: BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN;
  unit: "building" | "area";
}): ColumnMetadataValue | null => {
  if (isBuildingDatasetColumn(key, unit)) {
    return BUILDING_DATASET_COLUMN_METADATA[key];
  }
  if (isAreaDatasetColumn(key, unit)) {
    return AREA_DATASET_COLUMN_METADATA[key];
  }
  return null;
};
