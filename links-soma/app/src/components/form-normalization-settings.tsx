import {
  Card,
  makeStyles,
  Radio,
  RadioGroup,
  tokens,
} from "@fluentui/react-components";
import { LanguageMap } from "../metadata";
import { type PreprocessParameters } from "../@types/job-parameters";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { FormNormalizationAdvancedSettings } from "./form-normalization-advanced-settings";

const useStyles = makeStyles({
  basicFields: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  cardSurface: {
    padding: `${tokens.spacingHorizontalXL} ${tokens.spacingVerticalXL}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase400,
  },
});

type Props = {
  value: PreprocessParameters["settings"];
  onChange: (value: PreprocessParameters["settings"]) => void;
};

export const FormNormalizationSettings = ({
  value,
  onChange,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={styles.cardSurface}>
      <h3 className={styles.cardTitle}>設定値の変更</h3>
      <div className={styles.basicFields}>
        <Field
          label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
        >
          <Input
            defaultValue={value.reference_date}
            onChange={(_, data) => {
              onChange({
                ...value,
                reference_date:
                  data.value as PreprocessParameters["settings"]["reference_date"],
              });
            }}
            type="date"
          />
        </Field>

        <Field
          label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_data"]}
        >
          <RadioGroup
            defaultValue={value.reference_data}
            layout="horizontal"
            onChange={(_, data) => {
              onChange({
                ...value,
                reference_data:
                  data.value as PreprocessParameters["settings"]["reference_data"],
              });
            }}
          >
            <Radio
              label={LanguageMap.NORMALIZATION_DATA_LABEL["residentRegistry"]}
              value={"resident_registry"}
            />
          </RadioGroup>
        </Field>
      </div>

      <FormNormalizationAdvancedSettings
        onChange={(data) => {
          onChange({
            ...value,
            advanced: data,
          });
        }}
        value={value.advanced}
      />
    </Card>
  );
};
