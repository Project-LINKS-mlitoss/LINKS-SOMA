import { Label, makeStyles, tokens } from "@fluentui/react-components";
import { type UseFormRegister } from "react-hook-form";
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
});

type Props = {
  field: FilterCondition;
  label: string;
  register: UseFormRegister<FormFilterConditionType>;
  index: number;
  handleRemove: () => void;
};

export const FieldText = ({
  field,
  label,
  register,
  index,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (field.value.referenceColumnType !== "text") return <></>;

  return (
    <Field className={styles.groupField}>
      <Label>{label}</Label>
      <Select
        defaultValue={field.value.operation}
        {...register(`filterCondition.${index}.value.operation`)}
      >
        <option value="eq">次に等しい</option>
        <option value="noteq">次に等しくない</option>
        <option value="contains">次を含む</option>
        <option value="notContains">次を含まない</option>
      </Select>
      <Input
        defaultValue={field.value.value}
        {...register(`filterCondition.${index}.value.value`)}
        placeholder="値"
        type="text"
      />
      <Button
        appearance="subtle"
        icon={<Delete20Regular />}
        onClick={handleRemove}
        type="button"
      ></Button>
    </Field>
  );
};
