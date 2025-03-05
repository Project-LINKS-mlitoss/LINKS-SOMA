import {
  Caption1,
  Card,
  makeStyles,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeftFilled } from "@fluentui/react-icons";
import { Fragment, useEffect, useState } from "react";
import { type z } from "zod";
import { useParams } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { useDialogState } from "../../../hooks/use-dialog-state";
import { DialogImportNormalizedDataset } from "../../../components/dialog-import-normalized-dataset";
import { type SelectNormalizedDataSet } from "../../../schema";
import { DialogExplanatoryVariables } from "../../../components/dialog-explanatory-variables";
import { DialogModelAdvanced } from "../../../components/dialog-model-advanced";
import {
  type schema,
  useFormModelCreate,
} from "../../../hooks/use-form-model-create";
import { DialogModelMessage } from "../../../components/dialog-model-message";
import { useFetchDatasetColumns } from "../../../hooks/use-fetch-dataset-columns";
import { useFetchJob } from "../../../hooks/use-fetch-job";
import { useFetchDatasetWithFilePath } from "../../../hooks/use-fetch-dataset-with-file-path";
import { TextWithTooltip } from "../../../components/ui/text-with-tooltip";
import { lang } from "../../../lang";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../components/ui/breadcrumb";
import { ROUTES } from "../../../routes";

const useStyles = makeStyles({
  root: {
    display: "flex",
    gap: tokens.spacingVerticalXXL,
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
    height: "34px",
  },
  contents: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalXL,
    height: "68px",
  },
});

type FormType = z.infer<typeof schema>;

export const ModelCreate = (): JSX.Element => {
  const styles = useStyles();

  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading: isJobLoading } = useFetchJob({
    id: Number(id),
  });
  const modelCreateParameters =
    job?.parameters.parameterType === "ml" ? job.parameters : undefined;
  const { data: currentNormalizedDataset } = useFetchDatasetWithFilePath({
    type: "normalized",
    filePath: modelCreateParameters?.input_path,
  });
  const [normalizedDataSet, setNormalizedDataSet] =
    useState<SelectNormalizedDataSet>();

  const form = useFormModelCreate();
  const {
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = form;

  const [explanatoryVariables, setExplanatoryVariables] = useState<string[]>(
    form.formState.defaultValues?.settings?.explanatory_variables?.filter(
      (v) => v !== undefined,
    ) || [],
  );

  useEffect(
    function setCurrentValues() {
      if (!modelCreateParameters || !currentNormalizedDataset) return;

      setNormalizedDataSet(currentNormalizedDataset);
      setExplanatoryVariables(
        modelCreateParameters.settings.explanatory_variables,
      );
      setValue("settings.advanced", modelCreateParameters.settings.advanced);
    },
    [currentNormalizedDataset, modelCreateParameters, setValue],
  );

  const modelMessageDialogState = useDialogState();

  const onSubmit = handleSubmit(async (data: FormType) => {
    await window.ipcRenderer.invoke("buildModel", {
      data: {
        parameterType: "ml",
        ...data,
      },
    });
    modelMessageDialogState.setIsOpen(true);
  });

  const importNormalizedDatasetDialogState = useDialogState();

  const explanatoryVariablesDialogState = useDialogState();
  const { data: datasetColumns } = useFetchDatasetColumns({
    filename: normalizedDataSet?.file_path,
  });

  const modelAdvancedDialogState = useDialogState();
  const modelAdvanced = watch("settings.advanced");

  return (
    <form className={styles.root} onSubmit={onSubmit}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "モデル管理",
            href: ROUTES.MODEL.ROOT,
          },
          {
            children: "作成",
            current: true,
            href: ROUTES.MODEL.CREATE,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>
        <a href="#model">
          <ArrowLeftFilled />
        </a>
        モデル構築
      </h2>

      <div className={styles.contents}>
        <Card>
          <Subtitle2>
            <TextWithTooltip
              textNode={lang.pages["model/create"].subtitle1.label}
              tooltipContent={lang.pages["model/create"].subtitle1.description}
            />
          </Subtitle2>
          <div>{normalizedDataSet?.file_name}</div>
          <div>
            <Button
              appearance="primary"
              onClick={() => importNormalizedDatasetDialogState.setIsOpen(true)}
            >
              インポート
            </Button>
            <div>
              <Text>{errors.input_path?.message}</Text>
            </div>
          </div>
        </Card>
        <DialogImportNormalizedDataset
          dialogState={importNormalizedDatasetDialogState}
          onSelected={(data) => {
            setNormalizedDataSet(data);
            setValue("input_path", data.file_path);
          }}
        />

        <Card>
          <Subtitle2>
            <TextWithTooltip
              textNode={lang.pages["model/create"].subtitle2.label}
              tooltipContent={lang.pages["model/create"].subtitle2.description}
            />
          </Subtitle2>

          {normalizedDataSet?.file_name && explanatoryVariables.length > 0 && (
            <div>
              {explanatoryVariables.map((column, index) => (
                <Fragment key={column}>
                  <Caption1>{column}</Caption1>
                  {index !== explanatoryVariables.length - 1 && (
                    <Caption1>,</Caption1>
                  )}
                </Fragment>
              ))}
            </div>
          )}
          <div>
            <Button
              appearance="primary"
              onClick={() => explanatoryVariablesDialogState.setIsOpen(true)}
            >
              {explanatoryVariables.length > 0 ? "カラムを変更" : "インポート"}
            </Button>
          </div>
          <div>
            <Text>{errors.settings?.explanatory_variables?.message}</Text>
          </div>
        </Card>
        {!isJobLoading ? (
          <DialogExplanatoryVariables
            columnOptions={datasetColumns || []}
            dialogState={explanatoryVariablesDialogState}
            initialValues={
              modelCreateParameters?.settings.explanatory_variables
            }
            onSelected={(data) => {
              setExplanatoryVariables(data);
              setValue("settings.explanatory_variables", data);
            }}
          />
        ) : null}
        <Card>
          <Subtitle2>
            <TextWithTooltip
              textNode={lang.pages["model/create"].subtitle3.label}
              tooltipContent={lang.pages["model/create"].subtitle3.description}
            />
          </Subtitle2>
          {modelAdvanced && (
            <span>
              {Object.entries(modelAdvanced)
                .filter(([, value]) => value)
                /** @todo keyを日本語に置き換えたい */
                .map(([key, value]) => `${key}: ${value || "未設定"}`)
                .join(" / ")}
            </span>
          )}
          <div>
            <Button
              appearance="transparent"
              onClick={() => modelAdvancedDialogState.setIsOpen(true)}
            >
              高度な設定を変更
            </Button>
          </div>
          <div>
            <Text>{errors.settings?.advanced?.message}</Text>
          </div>
        </Card>
        {!isJobLoading ? (
          <DialogModelAdvanced
            dialogState={modelAdvancedDialogState}
            initialValues={
              modelCreateParameters?.settings.advanced ?? modelAdvanced
            }
            onSelected={(data) => setValue("settings.advanced", data)}
          />
        ) : null}
      </div>

      <div className={styles.footer}>
        <Button appearance="primary" size="large" type="submit">
          モデル構築
        </Button>
      </div>
      <DialogModelMessage dialogState={modelMessageDialogState} />
    </form>
  );
};
