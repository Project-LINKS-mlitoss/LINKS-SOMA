import { makeStyles, tokens } from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import {
  Field,
  Button,
  Input,
  Select,
} from "../../../../../shared/components/ui";
import { type GroupCondition } from "../../../types/models/parameter";

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
  valueRegister: Record<string, unknown>;
  handleRemove: () => void;
};

export const FieldText = ({
  field,
  labelRegister,
  operationRegister,
  valueRegister,
  handleRemove,
}: Props): JSX.Element => {
  const styles = useStyles();
  if (field.value.referenceColumnType !== "text") return <></>;

  return (
    <Field className={styles.groupField}>
      <Input
        className={styles.inputLabelValue}
        defaultValue={field.value.label}
        placeholder="グループ名"
        {...labelRegister}
      />
      <Select defaultValue={field.value.operation} {...operationRegister}>
        <option value="eq">次に等しい</option>
        <option value="noteq">次に等しくない</option>
        <option value="contains">次を含む</option>
        <option value="notContains">次を含まない</option>
      </Select>
      <Input
        defaultValue={field.value.value}
        {...valueRegister}
        placeholder="グループごとの値"
        type="text"
      />
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
