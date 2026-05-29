import {
  Caption1,
  Card,
  makeStyles,
  Subtitle2,
  Tag,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { type z } from "zod";
import { useParams } from "react-router-dom";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
  TagContainer,
  TextWithTooltip,
} from "../../../../shared/components/ui";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { DialogImportNormalizedDataset } from "../../components/dialog-import-normalized-dataset";
import { type SelectNormalizedDataSet } from "../../../../db/schema";
import { DialogExplanatoryVariables } from "../../components/dialog-explanatory-variables";
import { DialogModelAdvanced } from "../../components/dialog-model-advanced";
import {
  type schema,
  useFormModelCreate,
} from "../../hooks/use-form-model-create";
import { DEFAULT_EXPLANATORY_COLUMNS } from "../../constants";
import { DialogModelMessage } from "../../components/dialog-model-message";
import { useFetchDatasetColumns } from "../../../dataset/hooks/use-fetch-dataset-columns";
import { toOdsDisplayName } from "../../../../shared/types/optional-data-source";
import { useFetchJob } from "../../../job/hooks/use-fetch-job";
import { useFetchDatasetWithFilePath } from "../../../dataset/hooks/use-fetch-dataset-with-file-path";
import { lang } from "../../../../shared/config/lang";
import { SIDEBAR_WIDTH } from "../../../../shared/config/layout-constants";
import { THEME_COLORS } from "../../../../shared/config/theme-colors";
import { ROUTES } from "../../../../shared/config/routes";
import { FIELDS } from "../../components/dialog-model-advanced/const";

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
    justifyContent: "flex-end",
    alignItems: "center",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    position: "fixed",
    bottom: 0,
    left: SIDEBAR_WIDTH,
    right: 0,
  },
  buttonWithCount: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  selectedCount: {
    color: tokens.colorNeutralForeground3,
    marginTop: "2px",
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

  // データセット: ユーザー選択 ?? 既存ジョブの保存値
  const [userSelectedDataset, setUserSelectedDataset] =
    useState<SelectNormalizedDataSet | null>(null);
  const normalizedDataSet = userSelectedDataset ?? currentNormalizedDataset;

  const form = useFormModelCreate();
  const {
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = form;

  // 説明変数: ユーザー選択 > 既存ジョブの保存値 > デフォルトとCSV実カラムの交差
  const [userSelectedVariables, setUserSelectedVariables] = useState<
    string[] | null
  >(null);
  const { data: datasetColumns } = useFetchDatasetColumns({
    filename: normalizedDataSet?.file_path,
  });
  const explanatoryVariables = (() => {
    if (userSelectedVariables !== null) return userSelectedVariables;
    if (modelCreateParameters)
      return modelCreateParameters.settings.explanatory_variables;
    if (!datasetColumns) return [];
    return DEFAULT_EXPLANATORY_COLUMNS.filter((col) =>
      datasetColumns.includes(col),
    );
  })();

  const modelMessageDialogState = useDialogState();

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    // 導出値をフォームに同期してからバリデーション実行
    setValue("input_path", normalizedDataSet?.file_path ?? "");
    setValue("settings.explanatory_variables", explanatoryVariables);
    if (modelCreateParameters?.settings.advanced) {
      setValue("settings.advanced", modelCreateParameters.settings.advanced);
    }
    await handleSubmit(async (data: FormType) => {
      await window.ipcRenderer.invoke("buildModel", {
        data: {
          parameterType: "ml",
          ...data,
        },
      });
      modelMessageDialogState.setIsOpen(true);
    })(e);
  };

  const importNormalizedDatasetDialogState = useDialogState();

  const explanatoryVariablesDialogState = useDialogState();

  const modelAdvancedDialogState = useDialogState();
  const modelAdvanced = watch("settings.advanced");

  return (
    <form className={styles.root} onSubmit={onSubmit}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "モデル構築",
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
      <h2 className={styles.heading}>モデル構築</h2>

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
          </div>
          {errors.input_path?.message && (
            <Caption1 style={{ color: THEME_COLORS.error }}>
              {errors.input_path.message}
            </Caption1>
          )}
        </Card>
        <DialogImportNormalizedDataset
          dialogState={importNormalizedDatasetDialogState}
          onSelected={(data) => {
            setUserSelectedDataset(data);
            setUserSelectedVariables(null); // データセット変更時はデフォルト再計算
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
            <TagContainer>
              {explanatoryVariables.map((column, index) => (
                <Tag key={index} size="small">
                  <Caption1>{toOdsDisplayName(column)}</Caption1>
                </Tag>
              ))}
            </TagContainer>
          )}
          <div className={styles.buttonWithCount}>
            <Button
              appearance="primary"
              onClick={() => explanatoryVariablesDialogState.setIsOpen(true)}
            >
              {explanatoryVariables.length > 0 ? "カラムを変更" : "インポート"}
            </Button>
            {explanatoryVariables.length > 0 && (
              <Caption1 className={styles.selectedCount}>
                {explanatoryVariables.length}カラム選択中
              </Caption1>
            )}
          </div>
          {errors.settings?.explanatory_variables?.message && (
            <Caption1 style={{ color: THEME_COLORS.error }}>
              {errors.settings.explanatory_variables.message}
            </Caption1>
          )}
        </Card>
        {!isJobLoading ? (
          <DialogExplanatoryVariables
            columnOptions={datasetColumns || []}
            dialogState={explanatoryVariablesDialogState}
            initialValues={explanatoryVariables}
            onSelected={(data) => {
              setUserSelectedVariables(data);
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
            <TagContainer>
              {Object.entries(modelAdvanced)
                .filter(([, value]) => value)
                .map(([key, value]) => {
                  const field = FIELDS.find((field) => field.key === key);
                  return (
                    <Tag key={key} size="small">
                      <Caption1
                        key={key}
                      >{`${field?.label || key}: ${value || "未設定"}`}</Caption1>
                    </Tag>
                  );
                })}
            </TagContainer>
          )}
          <div>
            <Button
              appearance="transparent"
              onClick={() => modelAdvancedDialogState.setIsOpen(true)}
            >
              高度な設定を変更
            </Button>
          </div>
          {errors.settings?.advanced?.message && (
            <Caption1 style={{ color: THEME_COLORS.error }}>
              {errors.settings.advanced.message}
            </Caption1>
          )}
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
        <Button appearance="primary" size="medium" type="submit">
          モデル構築開始
        </Button>
      </div>
      <DialogModelMessage dialogState={modelMessageDialogState} />
    </form>
  );
};
