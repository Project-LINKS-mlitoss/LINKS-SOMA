import { Label, makeStyles, tokens } from "@fluentui/react-components";
import { type UseFormRegister } from "react-hook-form";
import { Delete20Regular } from "@fluentui/react-icons";
import { type FilterCondition } from "../../../bi-modules/interfaces/parameter";
import { Field } from "../../ui/field";
import { Select } from "../../ui/select";
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
});

type Props = {
  field: FilterCondition;
  label: string;
  register: UseFormRegister<FormFilterConditionType>;
  index: number;
  handleRemove: () => void;
};

export const FieldBoolean = ({
  field,
  label,
  register,
  index,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (field.value.referenceColumnType !== "boolean") return <></>;

  return (
    <Field className={styles.groupField}>
      <Label>{label}</Label>
      <Select
        defaultValue={field.value.operation}
        {...register(`filterCondition.${index}.value.operation`)}
      >
        <option value="isTrue">真である</option>
        <option value="isFalse">偽である</option>
      </Select>
      <Button
        appearance="subtle"
        icon={<Delete20Regular />}
        onClick={handleRemove}
        type="button"
      ></Button>
    </Field>
  );
};
