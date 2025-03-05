import { Controller, useController } from "react-hook-form";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useFormNormalization } from "../hooks/use-form-normalization";
import { type PreprocessParameters } from "../@types/job-parameters";
import { FormDataset } from "./form-dataset";
import { FormNormalizationSettings } from "./form-normalization-settings";
import { ErrorMessage } from "./error-message";

const useStyles = makeStyles({
  root: {
    display: "flex",
    gap: "20px",
    flexDirection: "column",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridAutoRows: "auto",
    gap: `${tokens.spacingHorizontalXL} ${tokens.spacingVerticalXL}`,
  },
});

type Props = {
  formId: string;
  preprocessParameters?: PreprocessParameters;
  afterSubmit: () => void;
};

export const FormNormalization = ({
  formId,
  preprocessParameters,
  afterSubmit,
}: Props): JSX.Element => {
  const form = useFormNormalization({
    defaultValues: preprocessParameters,
  });
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  const hasErrors = Object.keys(errors).length > 0;

  console.error(errors);

  const onSubmit = handleSubmit(async (data) => {
    await window.ipcRenderer.invoke("execE001", {
      parameters: {
        parameterType: "preprocess",
        settings: data.settings,
        data: data.data,
      },
    });
    afterSubmit();
  });

  const styles = useStyles();

  const {
    field: { value: settingsValue, onChange: settingsOnChange },
  } = useController({
    name: "settings",
    control,
  });

  return (
    <form className={styles.root} id={formId} onSubmit={onSubmit}>
      {hasErrors && (
        <ErrorMessage msg="エラーが発生しました。フォームの内容を確認してください。" />
      )}
      <Controller
        control={control}
        name={"data.resident_registry"}
        render={({ field: { value, onChange } }) => (
          <FormDataset
            appearance="large"
            dataKey="residentRegistry"
            onChange={onChange}
            value={value}
          />
        )}
      />

      <Controller
        control={control}
        name="data.water_status"
        render={({ field: { value, onChange } }) => (
          <FormDataset
            appearance="large"
            dataKey="waterStatus"
            onChange={onChange}
            value={value}
          />
        )}
      />
      <div className={styles.formGrid}>
        <Controller
          control={control}
          name="data.water_usage"
          render={({ field: { value, onChange } }) => (
            <FormDataset
              dataKey="waterUsage"
              onChange={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="data.land_registry"
          render={({ field: { value, onChange } }) => (
            <FormDataset
              dataKey="landRegistry"
              onChange={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="data.vacant_house"
          render={({ field: { value, onChange } }) => (
            <FormDataset
              dataKey="vacantHouse"
              onChange={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="data.geocoding"
          render={({ field: { value, onChange } }) => (
            <FormDataset
              dataKey="geocoding"
              onChange={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="data.building_polygon"
          render={({ field: { value, onChange } }) => (
            <FormDataset
              dataKey="buildingPolygon"
              form={form}
              onChange={onChange}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="data.census"
          render={({ field: { value, onChange } }) => (
            <FormDataset dataKey="census" onChange={onChange} value={value} />
          )}
        />
      </div>
      <FormNormalizationSettings
        onChange={settingsOnChange}
        value={settingsValue}
      />
    </form>
  );
};
