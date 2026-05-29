import {
  Checkbox,
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { type TileViewFieldOption } from "../types";
import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
  type BUILDING_DATASET_COLUMN,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../../shared/config/column-metadata";
import { FILTER_COLUMN_CATEGORIES } from "../config/tile-view-config";
import {
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "../../../shared/components/ui";

const useStyles = makeStyles({
  editButton: {
    minWidth: "50px",
    fontSize: "12px",
  },
  categoryHeader: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    padding: `${tokens.spacingVerticalS} 0`,
    marginTop: tokens.spacingVerticalM,
  },
  categoryHeaderFirst: {
    marginTop: 0,
  },
  categoryColumns: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: `${tokens.spacingVerticalS} 0`,
  },
  fieldset: {
    display: "flex",
    flexDirection: "column",
    maxHeight: "400px",
    overflowY: "scroll",
  },
});

type Props = {
  option: TileViewFieldOption["option"];
  currentValue: string;
  onSave: (value: string[]) => void;
};

export const DialogFieldOption = ({
  option,
  onSave,
  currentValue,
}: Props): JSX.Element => {
  const styles = useStyles();

  const [value, setValue] = useState<string[]>(
    currentValue.length > 0 ? currentValue.split(",") : [],
  );
  const isAllCleared = value.length === 0;

  const handleClick = (): void => {
    onSave(value);
  };

  // 選択した値を更新する。特に集計単位の変更時にダイアログの値をリセットするため
  useEffect(
    function updateValue() {
      setValue(currentValue.length > 0 ? currentValue.split(",") : []);
    },
    [currentValue],
  );

  // optionからunitを特定（全て同じunitのはず）
  const unit = option[0]?.unit ?? "building";
  const optionValues = option.map((o) => o.value);

  // カテゴリ別にグループ化されたカラムを生成
  const categorizedColumns = ((): {
    name: string;
    columns: (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[];
  }[] => {
    const categories = FILTER_COLUMN_CATEGORIES[unit];
    const categorizedInConfig = new Set<string>(
      categories.flatMap((cat) => cat.columns as string[]),
    );

    // カテゴリに含まれるカラムのみをフィルタリング（optionに存在するもののみ）
    const result: {
      name: string;
      columns: (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[];
    }[] = categories
      .map((category) => ({
        name: category.name,
        columns: (
          category.columns as (BUILDING_DATASET_COLUMN | AREA_DATASET_COLUMN)[]
        ).filter((col) => optionValues.includes(col)),
      }))
      .filter((category) => category.columns.length > 0);

    // カテゴリ定義にないがoptionに存在するカラムは「その他」として追加
    const uncategorizedColumns = optionValues.filter(
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

  return (
    <Dialog>
      <DialogTrigger>
        <Button className={styles.editButton}>変更</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>カラムを選択</DialogTitle>
          <DialogContent border>
            <div className={styles.fieldset}>
              {categorizedColumns.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <div
                    className={`${styles.categoryHeader} ${categoryIndex === 0 ? styles.categoryHeaderFirst : ""}`}
                  >
                    {category.name}
                  </div>
                  <div className={styles.categoryColumns}>
                    {category.columns.map((optionValue) => {
                      const columnMetadata =
                        optionValue in BUILDING_DATASET_COLUMN_METADATA
                          ? BUILDING_DATASET_COLUMN_METADATA[
                              optionValue as keyof typeof BUILDING_DATASET_COLUMN_METADATA
                            ]
                          : AREA_DATASET_COLUMN_METADATA[
                              optionValue as keyof typeof AREA_DATASET_COLUMN_METADATA
                            ];
                      if (columnMetadata === null) return null;
                      return (
                        <Checkbox
                          key={optionValue}
                          checked={value.includes(optionValue)}
                          id={optionValue}
                          label={columnMetadata?.label}
                          name={optionValue}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setValue([...value, optionValue]);
                            } else {
                              setValue(value.filter((v) => v !== optionValue));
                            }
                          }}
                          value={optionValue}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
          <DialogActions position="end">
            {isAllCleared ? (
              <Button
                onClick={() => {
                  setValue(option.map(({ value }) => value));
                }}
              >
                すべて選択
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setValue([]);
                }}
              >
                すべてクリア
              </Button>
            )}
            <DialogTrigger>
              <Button appearance="primary" onClick={handleClick} size="medium">
                保存
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
