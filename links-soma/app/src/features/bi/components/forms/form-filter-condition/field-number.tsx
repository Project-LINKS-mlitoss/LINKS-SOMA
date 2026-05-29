import {
  Checkbox,
  Label,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  type UseFormSetValue,
  type UseFormRegister,
  type UseFieldArrayUpdate,
} from "react-hook-form";
import { Delete20Regular } from "@fluentui/react-icons";
import { type FilterCondition } from "../../../types/models/parameter";
import {
  Field,
  Select,
  Input,
  Button,
} from "../../../../../shared/components/ui";
import { type FormFilterConditionType } from "./use-form-filter-condition";

const useStyles = makeStyles({
  groupField: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: "14px",
  },
  inputValue: {
    flexGrow: 1,
    flexBasis: "128px",
    flexShrink: 1,
  },
  inputRangeValue: {
    flexGrow: 1,
    width: "128px",
  },
  inputLabelValue: {
    width: "128px",
  },
  includesField: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    justifyContent: "center",
    fontSize: "12px",
    lineHeight: "12px",
    height: "36px",
    marginBottom: 0,
  },
  checkbox: {
    "&  div": {
      margin: "0",
    },
  },
});

type Props = {
  field: FilterCondition;
  label: string;
  unit: string;
  register: UseFormRegister<FormFilterConditionType>;
  setValue: UseFormSetValue<FormFilterConditionType>;
  update: UseFieldArrayUpdate<FormFilterConditionType>;
  index: number;
  handleRemove: () => void;
};

export const FieldNumber = ({
  field,
  label,
  unit,
  register,
  setValue,
  index,
  update,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (
    !(
      field.value.referenceColumnType === "float" ||
      field.value.referenceColumnType === "floatRange" ||
      field.value.referenceColumnType === "integer" ||
      field.value.referenceColumnType === "integerRange"
    )
  )
    return <></>;

  return (
    <Field className={styles.groupField}>
      <Label>{label}</Label>
      <Select
        onChange={(e) => {
          const operation = e.target.value;
          let referenceColumnType = field.value.referenceColumnType;

          // 範囲指定の場合はRange型に変更
          if (operation === "range") {
            if (referenceColumnType === "integer") {
              referenceColumnType = "integerRange";
            } else if (referenceColumnType === "float") {
              referenceColumnType = "floatRange";
            }
          } else {
            // 範囲以外の場合は基本型に戻す
            if (referenceColumnType === "integerRange") {
              referenceColumnType = "integer";
            } else if (referenceColumnType === "floatRange") {
              referenceColumnType = "float";
            }
          }

          update(index, {
            key: field.key,
            value: {
              ...field.value,
              // @ts-expect-error - ここで型が変わるためエラーになる
              operation,
              referenceColumnType,
            },
            type: "filter", // ここは固定
          });
        }}
        value={field.value.operation ?? "eq"}
      >
        <option value="eq">等しい</option>
        <option value="noteq">等しくない</option>
        <option value="gt">より大きい</option>
        <option value="lt">より小さい</option>
        <option value="gte">以上</option>
        <option value="lte">以下</option>
        <option value="range">次の範囲</option>
      </Select>
      {field.value.operation === "range" ? (
        <>
          <Input
            className={styles.inputRangeValue}
            defaultValue={
              field.value.startValue !== undefined
                ? field.value.startValue.toString()
                : ""
            }
            max={100}
            min={0}
            onBlur={(e) => {
              const parsed = parseFloat(e.target.value);
              const value =
                unit === "%" ? Math.max(0, Math.min(100, parsed)) : parsed;
              e.target.value = `${value}`;
              setValue(`filterCondition.${index}.value.startValue`, value);
            }}
            placeholder="開始値"
            type="number"
          />
          {unit ?? ""}
          <div className={styles.includesField}>
            <span>含</span>
            <Checkbox
              className={styles.checkbox}
              defaultChecked={field.value.includesStart ?? true}
              {...register(`filterCondition.${index}.value.includesStart`)}
            />
          </div>
          <span>〜</span>
          <Input
            className={styles.inputRangeValue}
            defaultValue={
              field.value.lastValue !== undefined
                ? field.value.lastValue.toString()
                : ""
            }
            max={100}
            min={0}
            onBlur={(e) => {
              const parsed = parseFloat(e.target.value);
              const value =
                unit === "%" ? Math.max(0, Math.min(100, parsed)) : parsed;
              e.target.value = `${value}`;
              setValue(`filterCondition.${index}.value.lastValue`, value);
            }}
            placeholder="終了値"
            type="number"
          />
          {unit ?? ""}
          <div className={styles.includesField}>
            <span>含</span>
            <Checkbox
              className={styles.checkbox}
              defaultChecked={field.value.includesLast ?? true}
              {...register(`filterCondition.${index}.value.includesLast`)}
            />
          </div>
        </>
      ) : (
        <>
          <Input
            className={styles.inputValue}
            defaultValue={
              field.value.value !== undefined
                ? field.value.value.toString()
                : ""
            }
            max={100}
            min={0}
            onBlur={(e) => {
              const parsed = parseFloat(e.target.value);
              const value =
                unit === "%" ? Math.max(0, Math.min(100, parsed)) : parsed;
              e.target.value = `${value}`;
              setValue(`filterCondition.${index}.value.value`, value);
            }}
            placeholder="値"
            type="number"
          />
          {unit ?? ""}
        </>
      )}

      <Button
        appearance="subtle"
        icon={<Delete20Regular />}
        onClick={handleRemove}
        type="button"
      ></Button>
    </Field>
  );
};
