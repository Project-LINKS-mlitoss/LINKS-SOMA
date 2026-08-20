import {
  Caption1,
  Dialog,
  DialogTrigger,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { getColumnMetadata } from "../../../../../shared/utils/get-column-metadata";
import {
  DialogBody,
  DialogSurface,
  DialogTitle,
  Button,
  DialogActions,
  DialogContent,
} from "../../../../../shared/components/ui";
import {
  type FilterCondition,
  isFilterCondition,
} from "../../../types/models/parameter";
import { FilterConditionColumnSelector } from "../filter-condition-column-selector";
import { type EditViewFormType } from "../../../types/models/form";
import { FieldBoolean } from "./field-boolean";
import { FieldText } from "./field-text";
import { FieldDate } from "./field-date";
import { FieldNumber } from "./field-number";
import { useFormFilterCondition } from "./use-form-filter-condition";

const useStyles = makeStyles({
  dialogContent: {
    padding: 0,
  },
  dialogContentNoBottomBorder: {
    borderBottom: "none",
  },
  dialogInner: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    width: "100%",
  },
  selectorContainer: {
    display: "grid",
    placeItems: "center",
    padding: `${tokens.spacingVerticalL} 0`,
  },
  textRight: {
    textAlign: "right",
  },
});

type Props = {
  currentFilterCondition: FilterCondition[];
};

/**
 * フィルタリング結果表示用のフィールド表示コンポーネント
 * FormFilteringParameters で選択されたフィルタリング条件や細かい条件を編集・表示する
 */
export const FormFilterCondition = ({
  currentFilterCondition,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const styles = useStyles();

  const {
    form: { register, setValue, handleSubmit },
    fieldState: filterConditionField,
  } = useFormFilterCondition({
    init: {
      filterCondition: currentFilterCondition,
    },
  });
  const { fields, update, remove, replace } = filterConditionField;

  // 保存済みの詳細条件が変わったらダイアログの field array に同期する。
  // currentFilterCondition は親の再レンダーごとに新しい .filter() 配列（identity 変化）に
  // なるため、identity 依存だと毎レンダー replace が走り編集中の条件を巻き戻す。値で比較する。
  const currentFilterConditionKey = JSON.stringify(currentFilterCondition);
  useEffect(() => {
    replace(currentFilterCondition);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentFilterCondition は key で値比較
  }, [currentFilterConditionKey]);

  const { watch, setValue: setEditViewFormValue } =
    useFormContext<EditViewFormType>();
  const unit = watch("unit");
  const currentParameters = watch("parameters");

  const saveAndClose = handleSubmit((data) => {
    /** 既存のグルーピング条件を削除 */
    const newParameters = currentParameters.filter(
      (f) => !isFilterCondition(f),
    );
    /** 新しいグルーピング条件を追加 */
    newParameters.push(...data.filterCondition);
    setEditViewFormValue("parameters", newParameters);
    setOpen(false);
  });

  return (
    <>
      <Dialog
        onOpenChange={() => {
          setOpen((prev) => !prev);
        }}
        open={open}
      >
        <DialogTrigger>
          <Button
            appearance={fields.length === 0 ? "outline" : "primary"}
            size="medium"
          >
            {fields.length === 0 ? "詳細条件を追加" : "詳細条件を編集"}
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <FilterConditionColumnSelector
                  filterConditionField={filterConditionField}
                />
              }
            >
              次の条件でフィルター
            </DialogTitle>
            <DialogContent
              border
              className={mergeClasses(
                styles.dialogContent,
                fields.length !== 0 && styles.dialogContentNoBottomBorder,
              )}
            >
              <div className={styles.dialogInner}>
                {fields.length === 0 ? (
                  <div className={styles.selectorContainer}>
                    <FilterConditionColumnSelector
                      appearance="primary"
                      filterConditionField={filterConditionField}
                    />
                  </div>
                ) : (
                  fields.map((field, index) => {
                    if (!isFilterCondition(field)) return null;
                    const metadata = getColumnMetadata({
                      unit,
                      key: field.value.referenceColumn,
                    });

                    const handleRemove = (): void => {
                      remove(index);
                    };

                    switch (field.value.referenceColumnType) {
                      case "boolean":
                        return (
                          <FieldBoolean
                            key={field.id}
                            field={field}
                            handleRemove={handleRemove}
                            index={index}
                            label={metadata?.label ?? "カラム"}
                            register={register}
                          />
                        );
                      case "text":
                        return (
                          <FieldText
                            key={field.id}
                            field={field}
                            handleRemove={handleRemove}
                            index={index}
                            label={metadata?.label ?? "カラム"}
                            register={register}
                          />
                        );
                      case "date":
                      case "dateRange":
                        return (
                          <FieldDate
                            key={field.id}
                            field={field}
                            handleRemove={handleRemove}
                            index={index}
                            label={metadata?.label ?? "カラム"}
                            register={register}
                            setValue={setValue}
                            unit={metadata?.unit || ""}
                          />
                        );
                      case "float":
                      case "floatRange":
                      case "integer":
                      case "integerRange":
                        return (
                          <FieldNumber
                            key={field.id}
                            field={field}
                            handleRemove={handleRemove}
                            index={index}
                            label={metadata?.label ?? "カラム"}
                            register={register}
                            setValue={setValue}
                            unit={metadata?.unit || ""}
                            update={update}
                          />
                        );
                      default:
                        return null;
                    }
                  })
                )}
              </div>
            </DialogContent>
            <DialogActions position="end">
              <Button appearance="primary" onClick={saveAndClose} type="button">
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {fields.length ? (
        <Caption1
          className={styles.textRight}
        >{`${fields.length}件の詳細フィルターを追加済み`}</Caption1>
      ) : null}
    </>
  );
};
