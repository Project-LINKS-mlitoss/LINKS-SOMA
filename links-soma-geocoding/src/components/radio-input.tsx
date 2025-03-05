import { useFormContext, Controller } from "react-hook-form";
import {
  makeStyles,
  tokens,
  Card,
  Field,
  Radio,
  RadioGroup,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  title: {
    margin: 0,
    fontWeight: tokens.fontWeightBold,
  },
});

export const RadioInput = (): JSX.Element => {
  const styles = useStyles();
  const {
    control,
    formState: { errors, touchedFields },
  } = useFormContext();

  const hasError = Boolean(errors.apiType && touchedFields.apiType);

  return (
    <Card>
      <div className={styles.title}>利用するAPI</div>
      <Field
        validationState={hasError ? "error" : undefined}
        validationMessage={
          hasError ? { children: errors.apiType?.message as string } : undefined
        }
      >
        <Controller
          name="apiType"
          control={control}
          rules={{ required: "APIを選択してください" }}
          render={({ field }) => (
            <RadioGroup
              {...field}
              onChange={(_, data) => field.onChange(data.value)}
            >
              <Radio value="aws" label="AWSジオコーディングAPI" />
              {/* <Radio value="zenrin" label="ゼンリンAPI" /> */}
            </RadioGroup>
          )}
        />
      </Field>
    </Card>
  );
};
