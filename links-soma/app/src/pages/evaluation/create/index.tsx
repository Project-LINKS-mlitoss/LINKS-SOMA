import { useEffect, useState } from "react";
import {
  Card,
  makeStyles,
  Subtitle2,
  tokens,
  typographyStyles,
  Dialog,
  Option,
  DialogTrigger,
  Caption1,
} from "@fluentui/react-components";
import { DeleteRegular, Dismiss24Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { type z } from "zod";
import { DialogSurface } from "../../../components/ui/dialog-surface";
import { DialogBody } from "../../../components/ui/dialog-body";
import { DialogTitle } from "../../../components/ui/dialog-title";
import { DialogContent } from "../../../components/ui/dialog-content";
import { DialogActions } from "../../../components/ui/dialog-actions";
import { DialogSetting } from "../../../components/dialog-setting";
import { useDialogState } from "../../../hooks/use-dialog-state";
import { Button } from "../../../components/ui/button";
import { DialogSelectDataset } from "../../../components/dialog-select-dataset";
import {
  useFormDataEvaluation,
  type schema,
} from "../../../hooks/use-form-data-evaluate";
import {
  type SelectModelFile,
  type SelectNormalizedDataSet,
  type SelectRawDataSet,
} from "../../../schema";
import { Dropdown } from "../../../components/ui/dropdown";
import { useFetchModelFiles } from "../../../hooks/use-fetch-model-files";
import { useFetchNormalizedDatasets } from "../../../hooks/use-fetch-normalized-datasets";
import { useFetchRawDatasets } from "../../../hooks/use-fetch-raw-datasets";
import { useFetchDatasetColumns } from "../../../hooks/use-fetch-dataset-columns";
import { ErrorMessage } from "../../../components/error-message";
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
  restartButton: {
    backgroundColor: "#6264A7",
    color: "#fff",
    borderRadius: "100px",
    padding: `${tokens.spacingVerticalMNudge} ${tokens.spacingHorizontalL}`,
    height: "40px",
  },
  file: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
  },
  deleteIconWrapper: {
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ":hover": {
      cursor: "pointer",
    },
  },
  button: {
    width: "130px",
  },
  text: typographyStyles.caption1Strong,
  dialogSurface: {
    width: "449px",
  },
  fileName: {
    color: "#6264A7",
    textDecoration: "underline",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  dropdownWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  dropdown: {
    width: "196px",
    height: "36px",
  },
});

type FormType = z.infer<typeof schema>;

export const JobEvaluationCreate = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const form = useFormDataEvaluation();

  // フォームのメソッドを取得
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const hasErrors = Object.keys(errors).length > 0;

  // ダイアログの状態管理
  const importModelDatasetDialogState = useDialogState();
  const importAnalysisDatasetDialogState = useDialogState();
  const importAreaDatasetDialogState = useDialogState();
  const analysisStartDialogState = useDialogState(false);

  // カラム情報と選択されたカラムの状態管理
  const [areaColumns, setAreaColumns] = useState<string[]>([]);

  // 選択された値を取得
  const modelPath = watch("model_path");
  const normalizedDatasetPaths = watch("normalized_dataset_paths");
  const threshold = watch("settings.threshold");
  const areaGroupIdColumn = watch("area_grouping.columns.area_group_id");
  const areaGroupNameColumn = watch("area_grouping.columns.area_group_name");
  const spatialFile = watch("area_grouping.path");

  // 表示用のステート
  const [modelName, setModelName] = useState<string>("");
  const [normalizedDatasetNames, setNormalizedDatasetNames] = useState<
    string[]
  >([]);
  const [spatialFileName, setSpatialFileName] = useState<string>("");

  // カラム情報を取得するフック
  const { data: areaFileColumns } = useFetchDatasetColumns({
    filename: spatialFile,
  });

  useEffect(() => {
    if (areaFileColumns) {
      setAreaColumns(areaFileColumns);
    } else {
      setAreaColumns([]);
    }
  }, [areaFileColumns]);

  // フォーム送信時の処理
  const onSubmit = handleSubmit(async (data: FormType) => {
    await window.ipcRenderer.invoke("evaluateData", {
      data: {
        parameterType: "result",
        ...data,
      },
    });
    analysisStartDialogState.setIsOpen(true);
  });

  // 分析対象のデータの削除
  const handleRemoveFile = (): void => {
    setValue("normalized_dataset_paths", []);
    setNormalizedDatasetNames([]);
  };

  // モデルファイルの削除
  const handleRemoveModelFile = (): void => {
    setValue("model_path", "");
    setModelName("");
  };

  // 地域集計用データの削除
  const handleRemoveAreaFile = (): void => {
    setValue("area_grouping.path", "");
    setSpatialFileName("");
    setAreaColumns([]);
    setValue("area_grouping.columns.area_group_id", "");
    setValue("area_grouping.columns.area_group_name", "");
  };

  const settingsThreshold = watch("settings.threshold");

  return (
    <form onSubmit={onSubmit}>
      <div className={styles.root}>
        <BreadcrumbBase
          breadcrumbItem={[
            {
              children: "空き家推定",
              href: ROUTES.EVALUATION.ROOT,
            },
            {
              children: "作成",
              current: true,
              href: ROUTES.EVALUATION.CREATE,
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
        <h2 className={styles.heading}>空き家推定</h2>

        <div className={styles.contents}>
          {hasErrors && (
            <ErrorMessage msg="エラーが発生しました。フォームの内容を確認してください。" />
          )}
          {/* モデルファイルの選択 */}
          <Card>
            <Subtitle2>
              <TextWithTooltip
                textNode={lang.pages["evaluation/create"].subtitle1.label}
                tooltipContent={
                  lang.pages["evaluation/create"].subtitle1.description
                }
              />
            </Subtitle2>
            <div className={styles.file}>
              {modelName ? (
                <>
                  <span className={styles.fileName}>{modelName}</span>
                  <span
                    className={styles.deleteIconWrapper}
                    onClick={handleRemoveModelFile}
                  >
                    <DeleteRegular fontSize={16} />
                  </span>
                </>
              ) : (
                <Button
                  appearance="primary"
                  onClick={() => importModelDatasetDialogState.setIsOpen(true)}
                >
                  選択
                </Button>
              )}
            </div>
          </Card>

          {/* ダイアログの定義 */}
          <DialogSelectDataset<SelectModelFile>
            dialogState={importModelDatasetDialogState}
            emptyMessage="現在表示できるモデルはありません"
            isModel
            onSelected={(data) => {
              setValue("model_path", data[0].file_path ?? "");
              setModelName(data[0].file_name ?? "");
            }}
            placeholder="モデル名"
            title="利用するモデルを選択"
            useFetchDatasets={useFetchModelFiles}
          />

          {/* 分析対象のデータの選択 */}
          <Card>
            <Subtitle2>
              <TextWithTooltip
                textNode={lang.pages["evaluation/create"].subtitle2.label}
                tooltipContent={
                  lang.pages["evaluation/create"].subtitle2.description
                }
              />
            </Subtitle2>
            <div className={styles.file}>
              {normalizedDatasetNames && normalizedDatasetNames.length > 0 ? (
                <div className={styles.fileItem}>
                  <span className={styles.fileName}>
                    {normalizedDatasetNames.join(",")}
                  </span>
                  <span
                    className={styles.deleteIconWrapper}
                    onClick={handleRemoveFile}
                  >
                    <DeleteRegular fontSize={16} />
                  </span>
                </div>
              ) : (
                <Button
                  appearance="primary"
                  onClick={() =>
                    importAnalysisDatasetDialogState.setIsOpen(true)
                  }
                >
                  選択
                </Button>
              )}
            </div>
          </Card>

          {/* ダイアログの定義 */}
          <DialogSelectDataset<SelectNormalizedDataSet>
            dialogState={importAnalysisDatasetDialogState}
            emptyMessage="現在表示できるデータセットはありません"
            multiple={true}
            onSelected={(selectedDatasets) => {
              const filePaths = selectedDatasets.map((d) => d.file_path || "");
              setValue("normalized_dataset_paths", filePaths);
              setNormalizedDatasetNames(
                selectedDatasets.map((d) => d.file_name || ""),
              );
            }}
            placeholder="データ名"
            title="分析を行う名寄せ処理済みデータセットを選択"
            useFetchDatasets={useFetchNormalizedDatasets}
          />

          {/* 地域集計用データの選択 */}
          <Card>
            <Subtitle2>
              <TextWithTooltip
                textNode={lang.pages["evaluation/create"].subtitle3.label}
                tooltipContent={
                  lang.pages["evaluation/create"].subtitle3.description
                }
              />
            </Subtitle2>
            <div className={styles.file}>
              {spatialFileName ? (
                <div className={styles.fileItem}>
                  <span className={styles.fileName}>{spatialFileName}</span>
                  <span
                    className={styles.deleteIconWrapper}
                    onClick={handleRemoveAreaFile}
                  >
                    <DeleteRegular fontSize={16} />
                  </span>
                </div>
              ) : (
                <Button
                  appearance="primary"
                  onClick={() => importAreaDatasetDialogState.setIsOpen(true)}
                >
                  選択
                </Button>
              )}
            </div>

            {/* ドロップダウンの表示 */}
            {spatialFile && (
              <div className={styles.dropdownWrapper}>
                <label htmlFor="area-id-dropdown">
                  <TextWithTooltip
                    textNode={lang.pages["evaluation/create"].column1.label}
                    tooltipContent={
                      lang.pages["evaluation/create"].column1.description
                    }
                  />
                </label>
                <Dropdown
                  className={styles.dropdown}
                  id="area-id-dropdown"
                  onOptionSelect={(event, data) =>
                    setValue(
                      "area_grouping.columns.area_group_id",
                      data.optionValue ?? "",
                    )
                  }
                  placeholder="選択"
                  value={areaGroupIdColumn}
                >
                  {areaColumns.map((column) => (
                    <Option key={column} text={column} value={column}>
                      {column}
                    </Option>
                  ))}
                </Dropdown>
                <label htmlFor="area-name-dropdown">
                  <TextWithTooltip
                    textNode={lang.pages["evaluation/create"].column2.label}
                    tooltipContent={
                      lang.pages["evaluation/create"].column2.description
                    }
                  />
                </label>
                <Dropdown
                  className={styles.dropdown}
                  id="area-name-dropdown"
                  onOptionSelect={(event, data) =>
                    setValue(
                      "area_grouping.columns.area_group_name",
                      data.optionValue ?? "",
                    )
                  }
                  placeholder="選択"
                  value={areaGroupNameColumn}
                >
                  {areaColumns.map((column) => (
                    <Option key={column} text={column} value={column}>
                      {column}
                    </Option>
                  ))}
                </Dropdown>
              </div>
            )}
          </Card>

          {/* ダイアログの定義 */}
          <DialogSelectDataset<SelectRawDataSet>
            dialogState={importAreaDatasetDialogState}
            emptyMessage="現在表示できるデータセットはありません"
            onSelected={(data) => {
              setValue("area_grouping.path", data[0].file_path || "");
              setSpatialFileName(data[0].file_name || "");
            }}
            placeholder="データ名"
            title="地域集計用データを選択"
            useFetchDatasets={useFetchRawDatasets}
          />

          {/* 高度な設定 */}
          <Card>
            <Subtitle2>
              <TextWithTooltip
                textNode={lang.pages["evaluation/create"].subtitle4.label}
                tooltipContent={
                  lang.pages["evaluation/create"].subtitle4.description
                }
              />
            </Subtitle2>
            <div>
              <Caption1>テキストマッチング: {settingsThreshold}</Caption1>
            </div>
            <div className={styles.file}>
              <DialogSetting
                onChange={(newValue) =>
                  setValue("settings.threshold", newValue.similarityThreshold)
                }
                value={{ similarityThreshold: threshold }}
              />
            </div>
          </Card>
        </div>

        {/* フッター */}
        <div className={styles.footer}>
          <Button
            className={styles.restartButton}
            disabled={
              !modelPath ||
              !normalizedDatasetPaths ||
              !spatialFile ||
              !areaGroupIdColumn ||
              !areaGroupNameColumn
            }
            type="submit"
          >
            分析開始
          </Button>
        </div>

        {/* 分析開始後のダイアログ */}
        <Dialog
          onOpenChange={(event, data) =>
            analysisStartDialogState.setIsOpen(data.open)
          }
          open={analysisStartDialogState.isOpen}
        >
          <DialogSurface className={styles.dialogSurface}>
            <DialogBody>
              <DialogTitle
                action={
                  <DialogTrigger action="close">
                    <Button
                      appearance="subtle"
                      aria-label="close"
                      icon={
                        <Dismiss24Regular
                          color={tokens.colorNeutralForeground1}
                          strokeWidth={2}
                        />
                      }
                      onClick={() => analysisStartDialogState.setIsOpen(false)}
                    />
                  </DialogTrigger>
                }
              >
                分析を開始しました
              </DialogTitle>
              <DialogContent>
                <div>
                  ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="primary"
                  onClick={() => {
                    analysisStartDialogState.setIsOpen(false);
                    navigate("/evaluation");
                  }}
                >
                  処理のステータスを確認
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
    </form>
  );
};
