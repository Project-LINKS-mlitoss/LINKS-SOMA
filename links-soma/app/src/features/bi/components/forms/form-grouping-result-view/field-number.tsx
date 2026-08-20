import { Checkbox, makeStyles, tokens } from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import { type UseFormRegister } from "react-hook-form";
import {
  Field,
  Button,
  Input,
  Select,
} from "../../../../../shared/components/ui";
import {
  type Parameter,
  type GroupCondition,
} from "../../../types/models/parameter";

const useStyles = makeStyles({
  groupField: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: "14px",
  },
  inputLabelValue: {
    width: "128px",
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
  field: GroupCondition;
  handleRemove: () => void;
  update: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  index: number;
  unit: string;
  register: UseFormRegister<{
    parameters: Parameter[];
  }>;
  /** 優先順位の表示と並べ替え操作。行の先頭に配置する */
  priority: JSX.Element;
};

export const FieldNumber = ({
  field,
  handleRemove,
  update,
  index,
  unit,
  register,
  priority,
}: Props): JSX.Element => {
  const styles = useStyles();
  if (
    !(
      field.value.referenceColumnType === "float" ||
      field.value.referenceColumnType === "integer" ||
      field.value.referenceColumnType === "floatRange" ||
      field.value.referenceColumnType === "integerRange"
    )
  )
    return <></>;

  return (
    <Field className={styles.groupField}>
      {priority}
      <Input
        className={styles.inputLabelValue}
        defaultValue={field.value.label}
        placeholder="グループ名"
        {...register(`parameters.${index}.value.label`)}
      />
      <Select onChange={update} value={field.value.operation ?? "eq"}>
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
            defaultValue={field.value.startValue?.toString()}
            placeholder="開始値"
            type="number"
            {...register(`parameters.${index}.value.startValue`)}
            className={styles.inputRangeValue}
          />
          {unit}
          <div className={styles.includesField}>
            <span>含</span>
            <Checkbox
              className={styles.checkbox}
              defaultChecked={field.value.includesStart ?? true}
              {...register(`parameters.${index}.value.includesStart`)}
            />
          </div>
          <span>〜</span>
          <Input
            defaultValue={field.value.lastValue?.toString()}
            placeholder="終了値"
            type="number"
            {...register(`parameters.${index}.value.lastValue`)}
            className={styles.inputRangeValue}
          />
          {unit}
          <div className={styles.includesField}>
            <span>含</span>
            <Checkbox
              className={styles.checkbox}
              defaultChecked={field.value.includesLast ?? true}
              {...register(`parameters.${index}.value.includesLast`)}
            />
          </div>
        </>
      ) : (
        <Input
          defaultValue={
            field.value.value !== null && field.value.value !== undefined
              ? field.value.value.toString()
              : ""
          }
          {...register(`parameters.${index}.value.value`)}
          className={styles.inputValue}
          placeholder="グループごとの値"
          type="number"
        />
      )}
      <Button
        appearance="subtle"
        icon={<Delete20Regular />}
        onClick={() => {
          handleRemove();
        }}
        type="button"
      ></Button>
    </Field>
  );
};
