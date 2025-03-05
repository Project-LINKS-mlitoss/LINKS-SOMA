import { makeStyles, tokens } from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import { Field } from "../../ui/field";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select } from "../../ui/select";
import { type GroupCondition } from "../../../bi-modules/interfaces/parameter";

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
});

type Props = {
  field: GroupCondition;
  labelRegister: Record<string, unknown>;
  operationRegister: Record<string, unknown>;
  handleRemove: () => void;
};

export const FieldBoolean = ({
  field,
  labelRegister,
  operationRegister,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();
  if (field.value.referenceColumnType !== "boolean") return <></>;

  return (
    <Field className={styles.groupField}>
      <Input
        className={styles.inputLabelValue}
        defaultValue={field.value.label}
        placeholder="グループ名"
        {...labelRegister}
      />
      <Select defaultValue={field.value.operation} {...operationRegister}>
        <option value="isTrue">真である</option>
        <option value="isFalse">偽である</option>
      </Select>
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
