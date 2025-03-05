import { type ForwardedRef, forwardRef, Fragment } from "react";
import { makeStyles, type DropdownProps } from "@fluentui/react-components";
import { type TileViewFieldOption } from "../../@types/charts";
import {
  AREA_DATASET_COLUMN_METADATA,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../config/column-metadata";
import { Select } from "../ui/select";
import { Field } from "../ui/field";
import { Dropdown } from "../ui/dropdown";
import { DialogFieldOption } from "../dialog-field-option";
import { DynamicColumnOptions } from "./dynamic-column-options";
import { DialogDynamicParameterInput } from "./dialog-dynamic-parameter-input";

const useStyles = makeStyles({
  selectedOptions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 8px",
    fontSize: "12px",
  },
  layout: {
    display: "flex",
    gap: "4px",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  noSelectedLabel: {
    lineHeight: "32px",
    fontSize: "12px",
  },
  labelContainer: {
    display: "flex",
    alignItems: "center",
  },
});

type Props = {
  unit: "building" | "area";
  value: string;
  name: string;
  fieldOption: TileViewFieldOption;
} & (
  | {
      type: "select";
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    }
  | {
      type: "dropdown";
      onChange: DropdownProps["onOptionSelect"];
      multiple: boolean;
    }
  | {
      type: "dialog";
      onSave: (value: string[]) => void;
      multiple: boolean;
    }
);

/**
 * 表示形式に合わせたfieldOptionを元に入力用のフィールドを生成する.
 * 内部でdynamic-column-options.tsxのDynamicColumnOptionsを利用して選択肢を生成する.
 *
 * @param unit `building` か``area``のどちらか集計単位
 * @returns
 */
export const DynamicParameterInput = forwardRef<
  HTMLSelectElement | HTMLButtonElement,
  Props
>((props, ref): JSX.Element => {
  const styles = useStyles();
  if (props.type === "select") {
    return (
      <Field
        label={
          <div className={styles.labelContainer}>
            {props.fieldOption.label}
            <DialogDynamicParameterInput fieldOption={props.fieldOption} />
          </div>
        }
      >
        {props.type === "select" && (
          <Select
            ref={ref as ForwardedRef<HTMLSelectElement>}
            name={props.name}
            onChange={props.onChange}
            value={props.value}
          >
            <DynamicColumnOptions
              fieldOption={props.fieldOption}
              type={props.type}
              unit={props.unit}
            />
          </Select>
        )}
      </Field>
    );
  }

  if (props.type === "dropdown" && props.fieldOption.type === "dropdown") {
    const displayValue =
      props.value !== ""
        ? props.unit === "building"
          ? props.value
              .split(",")
              // @ts-expect-error TODO: この辺りの型定義は別途修正が必要
              .map((v) => BUILDING_DATASET_COLUMN_METADATA[v].label)
              .join(",")
          : props.value
              .split(",")
              // @ts-expect-error TODO: この辺りの型定義は別途修正が必要
              .map((v) => AREA_DATASET_COLUMN_METADATA[v].label)
              .join(",")
        : "";

    return (
      <Field label={props.fieldOption.label}>
        <Dropdown
          ref={ref as ForwardedRef<HTMLButtonElement>}
          multiselect={props.multiple}
          name={props.name}
          onOptionSelect={props.onChange}
          selectedOptions={props.value.split(",")}
          value={displayValue} //表示用の値としてしか使われない（Controlledなため）
        >
          <DynamicColumnOptions
            fieldOption={props.fieldOption}
            type={props.type}
            unit={props.unit}
          />
        </Dropdown>
      </Field>
    );
  }
  if (props.type === "dialog") {
    return (
      <Field label={props.fieldOption.label}>
        <div className={styles.layout}>
          <div>
            {!props.value ? (
              <p className={styles.noSelectedLabel}>カラムを選択してください</p>
            ) : (
              <div className={styles.selectedOptions}>
                {props.value.split(",").map((item, index) => {
                  const columnMetadata =
                    item in BUILDING_DATASET_COLUMN_METADATA
                      ? BUILDING_DATASET_COLUMN_METADATA[
                          /** @fixme asしない方法あれば。 */
                          item as keyof typeof BUILDING_DATASET_COLUMN_METADATA
                        ]
                      : null;
                  if (columnMetadata === null) return null;
                  return (
                    <Fragment key={item}>
                      {index !== 0 && <span>/</span>}
                      <span key={item}>{columnMetadata?.label}</span>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <DialogFieldOption
              currentValue={props.value}
              onSave={props.onSave}
              option={props.fieldOption.option.filter(
                (option) => option.unit === props.unit,
              )}
            />
          </div>
        </div>
      </Field>
    );
  }

  return <></>;
});

DynamicParameterInput.displayName = "DynamicParameterInput";
