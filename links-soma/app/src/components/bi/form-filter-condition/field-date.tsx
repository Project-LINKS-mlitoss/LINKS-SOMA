import {
  Checkbox,
  Label,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { type UseFormSetValue, type UseFormRegister } from "react-hook-form";
import { Delete20Regular } from "@fluentui/react-icons";
import { type FilterCondition } from "../../../bi-modules/interfaces/parameter";
import { Field } from "../../ui/field";
import { Select } from "../../ui/select";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
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
  index: number;
  handleRemove: () => void;
};

export const FieldDate = ({
  field,
  label,
  unit,
  register,
  setValue,
  index,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (
    !(
      field.value.referenceColumnType === "date" ||
      field.value.referenceColumnType === "dateRange"
    )
  )
    return <></>;

  return (
    <Field className={styles.groupField}>
      <Label>{label}</Label>
      <Select
        defaultValue={field.value.operation}
        {...register(`filterCondition.${index}.value.operation`)}
      >
        <option value="eq">次に等しい</option>
        <option value="noteq">次に等しくない</option>
        <option value="gt">次より後</option>
        <option value="lt">次より前</option>
        <option value="gte">次以降</option>
        <option value="lte">次以前</option>
        <option value="range">次の範囲</option>
      </Select>
      {field.value.operation === "range" ? (
        <>
          <Input
            className={styles.inputRangeValue}
            defaultValue={
              field.value.startValue ? field.value.startValue.toString() : ""
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
            type="date"
          />
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
              field.value.lastValue ? field.value.lastValue.toString() : ""
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
            type="date"
          />
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
        <Input
          defaultValue={field.value.value ? field.value.value.toString() : ""}
          {...register(`filterCondition.${index}.value.value`)}
          className={styles.inputValue}
          placeholder="値"
          type="date"
        />
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
