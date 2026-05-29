/**
 * ウィザード設定ステップコンポーネント
 * 基準日・市区町村名の設定を行う
 */

import { Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { LanguageMap } from "../../../../shared/config/metadata";
import { lang } from "../../../../shared/config/lang";
import { Field } from "../../../../shared/components/ui/field";
import { Input } from "../../../../shared/components/ui/input";

const MUNICIPALITY_SUFFIXES = ["市", "区", "町", "村"];

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    width: "200px",
  },
  note: {
    color: tokens.colorNeutralForeground3,
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
};

export const WizardStepSettings = ({ form }: Props): JSX.Element => {
  const styles = useStyles();
  const settings = form.watch("settings");

  const municipalityValue = settings.municipality ?? "";
  const showMunicipalityNote =
    municipalityValue.length > 0 &&
    !MUNICIPALITY_SUFFIXES.some((s) => municipalityValue.endsWith(s));

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <Field
          label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
        >
          <Input
            defaultValue={settings.reference_date}
            onChange={(_, data) => {
              form.setValue("settings.reference_date", data.value);
            }}
            type="date"
          />
        </Field>
      </div>
      <div>
        <div className={styles.field}>
          <Field
            label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["municipality"]}
          >
            <Input
              defaultValue={municipalityValue}
              onChange={(_, data) => {
                form.setValue("settings.municipality", data.value);
              }}
              placeholder={
                lang.components.normalizationParameters.settingsMunicipality
                  .placeholder
              }
            />
          </Field>
        </div>
        {showMunicipalityNote && (
          <Caption1 className={styles.note}>
            {
              lang.components.normalizationParameters.settingsMunicipality
                .suffixNote
            }
          </Caption1>
        )}
      </div>
    </div>
  );
};
