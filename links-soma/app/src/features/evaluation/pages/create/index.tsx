import { useEffect, useMemo, useRef, useState } from "react";
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
  Caption2,
  Tag,
} from "@fluentui/react-components";
import {
  AddRegular,
  CheckmarkCircleRegular,
  DeleteRegular,
  Dismiss24Regular,
  InfoRegular,
} from "@fluentui/react-icons";
import { useLocation, useNavigate } from "react-router-dom";
import { type z } from "zod";
import { DialogSetting } from "../../components/dialog-setting";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { DialogSelectDataset } from "../../../../shared/components/dialog-select-dataset";
import {
  DEFAULT_EVALUATION_THRESHOLD,
  useFormDataEvaluation,
  type schema,
  type EvaluationPrefillState,
} from "../../hooks/use-form-data-evaluate";
import {
  type SelectModelFile,
  type SelectNormalizedDataSet,
} from "../../../../db/schema";
import { useFetchModelFiles } from "../../../model/hooks/use-fetch-model-files";
import { type ModelThreshold } from "../../../model/ipc/select-model-threshold";
import { useFetchDatasetColumns } from "../../../dataset/hooks/use-fetch-dataset-columns";
import { useFetchNormalizedDatasetGeometrySources } from "../../../dataset/hooks/use-fetch-normalized-dataset-geometry-sources";
import { shouldShowAreaForm } from "../../util/should-show-area-form";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { lang } from "../../../../shared/config/lang";
import { RequiredField } from "../../../../shared/components/required-field";
import { ProcessIntro } from "../../../../shared/components/process-intro";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  TagContainer,
  TextWithTooltip,
} from "../../../../shared/components/ui";
import { SIDEBAR_WIDTH } from "../../../../shared/config/layout-constants";
import { ROUTES } from "../../../../shared/config/routes";
import { useGuideStageResume } from "../../../../shared/tutorial/use-guide-stage-resume";
import { tutorialStore } from "../../../../shared/tutorial/store";
import { DialogSelectAnalysisDataset } from "./dialog-select-analysis-dataset";
import { DialogSelectAreaDataset } from "./dialog-select-area-dataset";

const useStyles = makeStyles({
  root: {
    display: "flex",
    gap: tokens.spacingVerticalXXL,
    flexDirection: "column",
    justifyContent: "space-between",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
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
  addButton: {
    minWidth: "auto",
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  fileListContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    width: "100%",
  },
  fileListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  fileListActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: tokens.spacingVerticalS,
  },
  dropdownWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  thresholdNotice: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    marginTop: `-${tokens.spacingVerticalXS}`,
    color: tokens.colorNeutralForeground3,
  },
  dropdown: {
    width: "196px",
    height: "36px",
  },
  stickyWrapper: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflowY: "scroll",
  },
  form: {
    minHeight: "calc(100vh - 60px)",
  },
  footerActions: {
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
});

type FormType = z.infer<typeof schema>;
const FORM_ID = "JobEvaluationCreate";

// パス末尾のファイル名を取り出す（Windows の \ と POSIX の / 両対応）。
// 本番は Windows なので区切りはどちらも来うる。表示ラベル導出のみに使う。
const basename = (filePath: string): string =>
  filePath.split(/[\\/]/).pop() ?? filePath;

export const JobEvaluationCreate = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  // 地域集計フォームの表示状態を検証（area_grouping 必須化）へ伝える。
  // 表示状態は選択データのジオメトリ源に依存しフォーム生成後に確定するため ref で受け渡す。
  const requireAreaGroupingRef = useRef(true);
  const form = useFormDataEvaluation(requireAreaGroupingRef);

  // フォームのメソッドを取得
  const {
    handleSubmit,
    setValue,
    watch,
    getValues,
    reset,
    formState: { errors },
  } = form;

  // ダイアログの状態管理
  const importModelDatasetDialogState = useDialogState();
  const importAnalysisDatasetDialogState = useDialogState();
  const importAreaDatasetDialogState = useDialogState();
  const analysisStartDialogState = useDialogState(false);

  // カラム情報と選択されたカラムの状態管理
  const [areaColumns, setAreaColumns] = useState<string[]>([]);

  // 選択された値を取得
  const threshold = watch("settings.threshold");
  const areaGroupIdColumn = watch("area_grouping.columns.area_group_id");
  const areaGroupNameColumn = watch("area_grouping.columns.area_group_name");
  const spatialFile = watch("area_grouping.path");

  // 表示用のステート
  const [modelName, setModelName] = useState<string>("");
  const [normalizedDatasetNames, setNormalizedDatasetNames] = useState<
    string[]
  >([]);
  const [normalizedDatasetPaths, setNormalizedDatasetPaths] = useState<
    string[]
  >([]);
  const [spatialFileName, setSpatialFileName] = useState<string>("");

  // モデル選択時に推奨閾値を反映した結果の通知。
  // applied: モデル閾値を settings.threshold へ適用済み。
  // missing: 推奨閾値が無く既定値へ戻す（調整は任意）。
  const [modelThresholdNotice, setModelThresholdNotice] = useState<
    "applied" | "missing" | null
  >(null);

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

  // 地域IDカラム / 地域名称カラムは、常に現在の地域集計用ファイル（areaColumns）に整合する（#1776）。
  // areaColumns は SWR キーが filename のため、ファイル切替後ロード完了までは空配列になる。
  // 空配列（ロード中・未選択）では何もしないことで、旧ファイル由来の値で誤プリセットしない。
  // 国勢調査データ（KEY_CODE と S_NAME を両方持つ）では未選択カラムを KEY_CODE / S_NAME に補完する。
  // 現在ファイルに存在しない選択値（旧ファイル由来）は破棄する。
  // 現在ファイルに存在する値をユーザーが手動選択している場合は上書きしない。
  useEffect(() => {
    if (areaColumns.length === 0) {
      return;
    }
    const isCensus =
      areaColumns.includes("KEY_CODE") && areaColumns.includes("S_NAME");

    if (!areaColumns.includes(areaGroupIdColumn)) {
      setValue(
        "area_grouping.columns.area_group_id",
        isCensus ? "KEY_CODE" : "",
      );
    }
    if (!areaColumns.includes(areaGroupNameColumn)) {
      setValue(
        "area_grouping.columns.area_group_name",
        isCensus ? "S_NAME" : "",
      );
    }
  }, [areaColumns, areaGroupIdColumn, areaGroupNameColumn, setValue]);

  // 選択中の名寄せデータがジオコーディングを使ったか取得する（issue #1924）。
  const { data: geometrySources, error: geometryError } =
    useFetchNormalizedDatasetGeometrySources(normalizedDatasetPaths);

  // 地域集計フォームの表示可否。地域集計（E032）は建物ジオメトリを地域ポリゴンへ空間結合する。
  // 建物ジオメトリは名寄せの空間結合（E016）で付くが、E016 はジオコーディングが無いと丸ごと
  // スキップされる（IF001.py: if has_geocoding）。建物ポリゴンも E016 内でしか使われないため、
  // ジオコーディングを使っていない名寄せデータでは地域集計は無意味。
  // 既定は非表示とし、ジオコーディングを使った（または判定不能・判定失敗の）データを選んだ時点で表示する。
  // 「一度出たフォームが消える」動きを避けるため、未選択時・初回判定ロード中も非表示にする（#1924）。
  // 表示判定の詳細と分岐網羅テストは util/should-show-area-form.ts。
  const showAreaForm = useMemo(
    () =>
      shouldShowAreaForm(
        normalizedDatasetPaths,
        geometrySources,
        !!geometryError,
      ),
    [normalizedDatasetPaths, geometrySources, geometryError],
  );

  // 検証（area_grouping 必須化）が最新の表示状態を読めるよう ref を同期する。
  requireAreaGroupingRef.current = showAreaForm;

  // 非表示へ切り替わったら選択済みの地域集計データをクリアし、送信時に空（=E032スキップ）にする。
  useEffect(() => {
    if (!showAreaForm) {
      setValue("area_grouping.path", "");
      setValue("area_grouping.columns.area_group_id", "");
      setValue("area_grouping.columns.area_group_name", "");
      setSpatialFileName("");
      setAreaColumns([]);
    }
  }, [showAreaForm, setValue]);

  // FR022 対話的閾値調整からの prefill 遷移: router state を検出したらフォームを上書きする。
  // 表示ラベルはパスの basename から導出（state にはフォーム値のみ載せる）。
  // 既存フローに合流させるだけで、推定開始は依然ユーザーが押す。
  useEffect(() => {
    const state = location.state as Partial<EvaluationPrefillState> | null;
    const prefill = state?.evaluationPrefill;
    if (!prefill) return;

    reset(prefill.form);
    setModelName(
      prefill.form.model_path ? basename(prefill.form.model_path) : "",
    );
    setNormalizedDatasetPaths(prefill.form.normalized_dataset_paths);
    setNormalizedDatasetNames(
      prefill.form.normalized_dataset_paths.map(basename),
    );
    const areaPath = prefill.form.area_grouping.path;
    setSpatialFileName(areaPath ? basename(areaPath) : "");

    // 再適用・戻る操作での再発火を防ぐため、適用後に state を消す。
    navigate(ROUTES.EVALUATION.CREATE, { replace: true, state: null });
    // 初回マウント時の prefill 適用のみを意図する。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill 適用は1回限り
  }, []);

  // ガイド進行中のみ: 推定フォーム (選択値・表示ラベル) を中断→復元できるようにする (ADR-0024)。
  // area カラムは spatialFile から再導出されるため snapshot に含めない。
  useGuideStageResume({
    stage: "evaluation",
    apply: (snapshot) => {
      if (snapshot.stage !== "evaluation") return;
      const fv = snapshot.formValues as {
        form?: Parameters<typeof reset>[0];
        display?: {
          modelName?: string;
          normalizedDatasetNames?: string[];
          normalizedDatasetPaths?: string[];
          spatialFileName?: string;
        };
      };
      if (fv.form) reset(fv.form);
      if (fv.display) {
        setModelName(fv.display.modelName ?? "");
        setNormalizedDatasetNames(fv.display.normalizedDatasetNames ?? []);
        setNormalizedDatasetPaths(fv.display.normalizedDatasetPaths ?? []);
        setSpatialFileName(fv.display.spatialFileName ?? "");
      }
    },
    takeSnapshot: () => ({
      stage: "evaluation",
      formValues: {
        form: getValues(),
        display: {
          modelName,
          normalizedDatasetNames,
          normalizedDatasetPaths,
          spatialFileName,
          // ガイドが地域集計ステップを飛ばすか判定するため表示状態を残す（#1924）
          showAreaForm,
        },
      },
    }),
    deps: [
      modelName,
      normalizedDatasetPaths,
      spatialFileName,
      showAreaForm,
      threshold,
      areaGroupIdColumn,
      areaGroupNameColumn,
    ],
  });

  // フォーム送信時の処理
  const onSubmit = handleSubmit(async (data: FormType) => {
    // 地域集計フォーム非表示時は area_grouping を送らない（IF003 が E032 をスキップ）。
    // reactive クリアを取りこぼしても（prefill 等）送信値を表示状態に一致させる安全ネット（#1924）。
    const payload: FormType = showAreaForm
      ? data
      : {
          ...data,
          area_grouping: {
            path: "",
            columns: { area_group_id: "", area_group_name: "" },
          },
        };
    const jobId = await window.ipcRenderer.invoke("evaluateData", {
      data: {
        parameterType: "result",
        ...payload,
      },
    });
    // ガイドの推定工程中なら、作成したジョブを参照記録し進行状態バッジに使う（ADR-0024）。
    const guide = tutorialStore.getState();
    if (
      guide.phase === "running" &&
      guide.stage === "evaluation" &&
      jobId != null
    ) {
      tutorialStore.setEvaluationJobId(jobId);
    }
    analysisStartDialogState.setIsOpen(true);
  });

  // 分析対象のデータの全削除
  const handleRemoveAllFiles = (): void => {
    setValue("normalized_dataset_paths", []);
    setNormalizedDatasetNames([]);
    setNormalizedDatasetPaths([]);
  };

  // 分析対象のデータの個別削除
  const handleRemoveFileByIndex = (index: number): void => {
    const updatedPaths = normalizedDatasetPaths.filter((_, i) => i !== index);
    const updatedNames = normalizedDatasetNames.filter((_, i) => i !== index);

    setValue("normalized_dataset_paths", updatedPaths);
    setNormalizedDatasetPaths(updatedPaths);
    setNormalizedDatasetNames(updatedNames);
  };

  // 分析対象のデータの追加
  const handleAddAnalysisDatasets = (
    datasets: SelectNormalizedDataSet[],
  ): void => {
    const newPaths = datasets.map((d) => d.file_path || "");
    const newNames = datasets.map((d) => d.file_name || "");

    const updatedPaths = [...normalizedDatasetPaths, ...newPaths];
    const updatedNames = [...normalizedDatasetNames, ...newNames];

    setValue("normalized_dataset_paths", updatedPaths);
    setNormalizedDatasetPaths(updatedPaths);
    setNormalizedDatasetNames(updatedNames);
  };

  // モデル選択時: そのモデルが学習時に保存した推奨閾値を settings.threshold へ反映する。
  // 推奨閾値が無い（手動アップロード・旧形式等）場合は既定値へ戻し、手動設定を促す通知を出す。
  const handleSelectModel = async (
    selected: SelectModelFile[],
  ): Promise<void> => {
    const model = selected[0];
    setValue("model_path", model.file_path ?? "");
    setModelName(model.file_name ?? "");

    let threshold: ModelThreshold["threshold"] = null;
    try {
      ({ threshold } = (await window.ipcRenderer.invoke(
        "selectModelThreshold",
        {
          modelFileId: model.id,
        },
      )) as ModelThreshold);
    } catch (error) {
      // 取得失敗時は直前モデルの推奨値が残らないよう既定値へ倒す（threshold は null のまま）。
      rendererLogger.error("selectModelThreshold failed", error, {
        modelFileId: model.id,
      });
    }

    if (threshold != null) {
      setValue("settings.threshold", threshold);
      setModelThresholdNotice("applied");
    } else {
      // 推奨閾値が無い／取得失敗のモデルでは、直前モデルの推奨値が残らないよう既定値へ戻す。
      setValue("settings.threshold", DEFAULT_EVALUATION_THRESHOLD);
      setModelThresholdNotice("missing");
    }
  };

  // モデルファイルの削除
  const handleRemoveModelFile = (): void => {
    setValue("model_path", "");
    setModelName("");
    setModelThresholdNotice(null);
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
    <div className={styles.stickyWrapper}>
      <form className={styles.form} id={FORM_ID} onSubmit={onSubmit}>
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

          <ProcessIntro description={lang.components.processIntro.evaluation} />

          <div className={styles.contents}>
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
              <RequiredField error={errors.normalized_dataset_paths}>
                <div className={styles.file}>
                  {normalizedDatasetNames &&
                  normalizedDatasetNames.length > 0 ? (
                    <div className={styles.fileListContainer}>
                      {normalizedDatasetNames.map((name, index) => (
                        <div
                          key={`${name}-${index}`}
                          className={styles.fileListItem}
                        >
                          <span className={styles.fileName}>{name}</span>
                          <span
                            className={styles.deleteIconWrapper}
                            onClick={() => handleRemoveFileByIndex(index)}
                          >
                            <DeleteRegular fontSize={16} />
                          </span>
                        </div>
                      ))}
                      <div className={styles.fileListActions}>
                        <Button
                          appearance="outline"
                          className={styles.addButton}
                          icon={<AddRegular />}
                          onClick={() =>
                            importAnalysisDatasetDialogState.setIsOpen(true)
                          }
                        >
                          追加
                        </Button>
                        <Button
                          appearance="subtle"
                          onClick={handleRemoveAllFiles}
                        >
                          すべて削除
                        </Button>
                      </div>
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
              </RequiredField>
            </Card>

            {/* ダイアログの定義 */}
            <DialogSelectAnalysisDataset
              dialogState={importAnalysisDatasetDialogState}
              existingPaths={normalizedDatasetPaths}
              onSelected={handleAddAnalysisDatasets}
            />

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
              <RequiredField error={errors.model_path}>
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
                      onClick={() =>
                        importModelDatasetDialogState.setIsOpen(true)
                      }
                    >
                      選択
                    </Button>
                  )}
                </div>
              </RequiredField>
            </Card>

            {/* ダイアログの定義 */}
            <DialogSelectDataset<SelectModelFile>
              dialogState={importModelDatasetDialogState}
              emptyMessage="現在表示できるモデルはありません"
              isModel
              onSelected={handleSelectModel}
              placeholder="モデル名"
              title="利用するモデルを選択"
              useFetchDatasets={useFetchModelFiles}
            />

            {/* 地域集計用データの選択。ジオコーディングを使っていない名寄せデータでは非表示（#1924） */}
            {showAreaForm && (
              <>
                <Card>
                  <Subtitle2>
                    <TextWithTooltip
                      textNode={lang.pages["evaluation/create"].subtitle3.label}
                      tooltipContent={
                        lang.pages["evaluation/create"].subtitle3.description
                      }
                    />
                  </Subtitle2>
                  <RequiredField error={errors.area_grouping?.path}>
                    <div className={styles.file}>
                      {spatialFileName ? (
                        <div className={styles.fileItem}>
                          <span className={styles.fileName}>
                            {spatialFileName}
                          </span>
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
                          onClick={() =>
                            importAreaDatasetDialogState.setIsOpen(true)
                          }
                        >
                          選択
                        </Button>
                      )}
                    </div>
                  </RequiredField>

                  {/* ドロップダウンの表示 */}
                  {spatialFile && (
                    <div className={styles.dropdownWrapper}>
                      <label htmlFor="area-id-dropdown">
                        <TextWithTooltip
                          textNode={
                            lang.pages["evaluation/create"].column1.label
                          }
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
                          textNode={
                            lang.pages["evaluation/create"].column2.label
                          }
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
                <DialogSelectAreaDataset
                  dialogState={importAreaDatasetDialogState}
                  onSelected={(data) => {
                    setValue("area_grouping.path", data.file_path || "");
                    setSpatialFileName(data.file_name || "");
                  }}
                />
              </>
            )}

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
              <TagContainer>
                <Tag size="small">
                  <Caption1>
                    {lang.pages["evaluation/create"].settingsThreshold.label}:{" "}
                    {settingsThreshold}
                  </Caption1>
                </Tag>
              </TagContainer>
              {modelThresholdNotice && (
                <div className={styles.thresholdNotice}>
                  {modelThresholdNotice === "missing" ? (
                    <InfoRegular fontSize={12} />
                  ) : (
                    <CheckmarkCircleRegular fontSize={12} />
                  )}
                  <Caption2>
                    {modelThresholdNotice === "applied"
                      ? lang.pages["evaluation/create"].settingsThreshold
                          .modelAppliedNotice
                      : lang.pages["evaluation/create"].settingsThreshold
                          .modelMissingNotice}
                  </Caption2>
                </div>
              )}
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
        </div>
      </form>
      <div className={styles.footerActions}>
        <Button appearance="primary" form={FORM_ID} size="medium" type="submit">
          推定開始
        </Button>

        {/* 推定開始後のダイアログ */}
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
    </div>
  );
};
