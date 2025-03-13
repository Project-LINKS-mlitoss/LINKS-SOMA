import { useEffect, useState } from "react";
import {
  Caption1,
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { type UseFormReturn } from "react-hook-form";
import { type ChartColumnType } from "../../../@types/charts";
import { Button } from "../../ui/button";
import { DialogBody } from "../../ui/dialog-body";
import { DialogSurface } from "../../ui/dialog-surface";
import { DialogTitle } from "../../ui/dialog-title";
import { DialogActions } from "../../ui/dialog-actions";
import { DialogContent } from "../../ui/dialog-content";
import {
  isGroupCondition,
  type Parameter,
} from "../../../bi-modules/interfaces/parameter";
import { useFormGroupingResultView } from "../../../bi-modules/hooks/use-form-grouping-result-view";
import { FieldBoolean } from "./field-boolean";
import { FieldText } from "./field-text";
import { FieldDate } from "./field-date";
import { FieldNumber } from "./field-number";

const useStyles = makeStyles({
  appendButtonField: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
  },
  dialogContent: {
    padding: 0,
  },
  dialogInner: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    width: "100%",
  },
  appendContainer: {
    display: "grid",
    placeItems: "center",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
  },
  textRight: {
    textAlign: "right",
  },
});

type Props = {
  parameters: Parameter[];
  columnLabel: string;
  columnType: ChartColumnType;
  unit?: string;
  formGroupingResultView: UseFormReturn<{ parameters: Parameter[] }>;
  onSave: (parameters: Parameter[]) => void;
};

/**
 * グルーピング用の条件を設定するコンポーネント
 */
export const FormGroupingResultView = ({
  parameters,
  unit = "",
  columnLabel,
  onSave,
  columnType,
  formGroupingResultView,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(false);

  const styles = useStyles();

  const { register } = formGroupingResultView;

  const {
    parameterFilters,
    fieldArray: { fields, update, replace },
    handleAppend,
    handleSave,
    handleRemove,
  } = useFormGroupingResultView({
    formGroupingResultView,
    parameters,
    onSave,
    columnType,
  });

  /** フォーカス切り替え時にダイアログに反映させるため */
  useEffect(() => {
    const groupingFields = parameters.filter((field) => {
      return field.type === "group";
    });
    replace(groupingFields);
  }, [parameters, replace]);

  const formatedParameterFilters = [...parameterFilters].filter((parameter) =>
    isGroupCondition(parameter),
  );

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
            appearance={parameterFilters.length === 0 ? "outline" : "primary"}
            size="medium"
          >
            {parameterFilters.length === 0
              ? "ラベルのグループを追加"
              : "ラベルのグループを編集"}
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {columnLabel
                ? `ラベルのグループを編集（${columnLabel}）`
                : "ラベルのグループを編集"}
            </DialogTitle>
            <DialogContent border className={styles.dialogContent}>
              <div className={styles.dialogInner}>
                {fields.length === 0 ? (
                  <div className={styles.appendContainer}>
                    <Button onClick={handleAppend}>追加</Button>
                  </div>
                ) : (
                  fields.map((field, index) => {
                    if (field.type !== "group") return null;

                    /** columnタイプ別にフィールドを分岐 */
                    switch (field.value.referenceColumnType) {
                      case "boolean":
                        return (
                          <FieldBoolean
                            key={field.id}
                            field={field}
                            handleRemove={() => handleRemove(index)}
                            labelRegister={register(
                              `parameters.${index}.value.label`,
                            )}
                            operationRegister={register(
                              `parameters.${index}.value.operation`,
                            )}
                          />
                        );
                      case "text":
                        return (
                          <FieldText
                            key={field.id}
                            field={field}
                            handleRemove={() => handleRemove(index)}
                            labelRegister={register(
                              `parameters.${index}.value.label`,
                            )}
                            operationRegister={register(
                              `parameters.${index}.value.operation`,
                            )}
                            valueRegister={register(
                              `parameters.${index}.value.value`,
                            )}
                          />
                        );
                      case "date":
                      case "dateRange":
                        return (
                          <FieldDate
                            key={field.id}
                            field={field}
                            handleRemove={() => handleRemove(index)}
                            index={index}
                            register={register}
                          />
                        );
                      case "float":
                      case "integer":
                      case "floatRange":
                      case "integerRange":
                        return (
                          <FieldNumber
                            key={field.id}
                            field={field}
                            handleRemove={() => handleRemove(index)}
                            index={index}
                            register={register}
                            unit={unit}
                            update={(e) => {
                              const referenceColumnType =
                                e.target.value === "range"
                                  ? field.value.referenceColumnType + "Range"
                                  : field.value.referenceColumnType.replace(
                                      "Range",
                                      "",
                                    );
                              update(index, {
                                key: field.key,
                                value: {
                                  ...field.value,
                                  // @ts-expect-error - ここで型が変わるためエラーになる
                                  operation: e.target.value,
                                  // @ts-expect-error - 解決できない
                                  referenceColumnType,
                                },
                                type: "group",
                              });
                            }}
                          />
                        );

                      default:
                        return null;
                    }
                  })
                )}
                {fields.length !== 0 && (
                  <div className={styles.appendButtonField}>
                    <Button onClick={handleAppend}>追加</Button>
                  </div>
                )}
              </div>
            </DialogContent>
            <DialogActions position="end">
              <Button
                appearance={parameters.length === 0 ? "outline" : "primary"}
                onClick={async () => {
                  await handleSave();
                  setOpen(false);
                }}
                type="button"
              >
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {formatedParameterFilters.length ? (
        <Caption1
          className={styles.textRight}
        >{`${formatedParameterFilters.length}件のグループを追加済み`}</Caption1>
      ) : null}
    </>
  );
};
