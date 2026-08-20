/**
 * 名寄せ処理ウィザードコンテナ
 * ウィザード全体のレイアウトと状態管理を担当
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import {
  useFormNormalization,
  type NormalizationPurpose,
} from "../../hooks/use-form-normalization";
import {
  type PreprocessParameters,
  type JoinCheckTarget,
  type DraftPreprocessParameters,
} from "../../../../shared/types/job-parameters";
import { type JoinCheckTaskResult } from "../../../../shared/types/job-task-result";
import { type SelectJobTask } from "../../../../db/schema";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { normalizationPurposeLabel } from "../../../../shared/config/normalization-purpose-label";
import { tutorialStore, useTutorial } from "../../../../shared/tutorial/store";
import { notifyJobChanged } from "../../../job/hooks/job-change-notifier";
import { useWizardState } from "./use-wizard-state";
import { WizardHeader } from "./wizard-header";
import { WizardFooter } from "./wizard-footer";
import { WizardStepRenderer } from "./wizard-step-renderer";
import { WizardSidePanel } from "./wizard-side-panel";
import {
  DialogJoinCheck,
  type JoinResult,
  type DatasetInfo,
} from "./_components/dialog-join-check";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    paddingBottom: "41px", // フッターの高さ分
  },
  body: {
    display: "grid",
    // 右サイドパネルはマニュアル・ヒント（取得方法/必要カラム/注意）を載せるため広めに取る。
    gridTemplateColumns: "1fr 400px",
    gap: tokens.spacingHorizontalL,
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
  // intro はサイドパネルを出さず全幅1カラム（進め方→揃えるデータを一つの読み筋にする）。
  bodyFull: {
    gridTemplateColumns: "1fr",
  },
  main: {
    overflowY: "auto",
    padding: `0 ${tokens.spacingHorizontalM}`,
  },
});

type Props = {
  /** ジョブ経由再実行時のパラメータ */
  preprocessParameters?: PreprocessParameters;
  /** 送信完了後のコールバック */
  afterSubmit: () => void;
  /** 下書きjobのID（下書き再開時） */
  initialJobId?: number;
  /** 住所の表記ゆれチェックjobのID（下書き再開時、結果復元用） */
  initialJoinCheckJobId?: number;
  /** 開始ステップ（クエリパラメータから決定） */
  initialStep: number;
  /** 下書きからの再開かどうか */
  isDraft?: boolean;
  /** 初期手動スキップ状態（下書き再開時） */
  initialManuallySkippedSteps?: number[];
  /** 新規開始時の初期目的（モデル構築画面からの導線で指定）。下書き/再実行では無視。 */
  initialPurpose?: NormalizationPurpose;
};

export const WizardContainer = ({
  preprocessParameters,
  afterSubmit,
  initialJobId,
  initialJoinCheckJobId,
  initialStep,
  isDraft = false,
  initialManuallySkippedSteps,
  initialPurpose,
}: Props): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  // `useFetchJob` は useSWRImmutable のまま (wizard 再開時の form 復元用)。
  // 自動保存後に mutate でキャッシュ無効化する必要があるため SWR 依存を残す。
  // 一覧系 hook (`useFetchDraftJob` / `useFetchJobsWithPagination`) は
  // pub/sub (`notifyJobChanged`) 側を使う (ADR-0020)。両者は別経路で共存する。
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 「開始する」を押して必須未充足でブロックしたか。確認画面の検証表示を押下時に出すため
  // （推定・モデル構築と同じく、送信を試みて初めて検証メッセージを見せる）。
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isJoinRateDialogOpen, setIsJoinRateDialogOpen] = useState(false);
  const [configuredDatasets, setConfiguredDatasets] = useState<
    JoinCheckTarget[]
  >([]);
  const [joinRateResults, setJoinRateResults] = useState<JoinResult[]>([]);
  const [joinRateExpandedTargets, setJoinRateExpandedTargets] = useState<
    Set<JoinCheckTarget>
  >(new Set());
  const [waterStatusDataset, setWaterStatusDataset] = useState<DatasetInfo>({
    path: "",
    addressColumn: "",
  });
  const [datasetInfoMap, setDatasetInfoMap] = useState<
    Partial<Record<JoinCheckTarget, DatasetInfo>>
  >({});

  // 下書きjobのID管理
  const [jobId, setJobId] = useState<number | undefined>(initialJobId);

  // フォーム状態（既存のフックを使用）
  const form = useFormNormalization({
    defaultValues: preprocessParameters,
    initialPurpose,
  });

  // 目的。intro での選択に応じて必須性・説明文を出し分ける。
  const purpose = form.watch("settings.purpose");

  // ウィザード状態
  const wizard = useWizardState({
    initialStep,
    initialManuallySkippedSteps,
    purpose,
  });

  // ガイドの phase/stage を購読する。ウィザードが既にマウント済みのままガイドを
  // (再)起動しても resumeState を詰め直せるよう、store 変化に反応させる。
  const { phase: tutorialPhase, stage: tutorialStage } = useTutorial();

  // ガイド進行中のみ: 名寄せの draft 参照と該当ステップを tutorial_state に同期する。
  // 中断/離脱後に「続きへ」で該当ステップへ deep-link するための復元情報 (ADR-0024)。
  // begin() は resumeState を null 化するため、同一ルートで再起動されても（＝ウィザードが
  // 再マウントされず step 系 dep が変化しなくても）phase 遷移を dep に含めて詰め直す。
  useEffect(() => {
    if (tutorialPhase !== "running" || tutorialStage !== "normalization")
      return;
    if (jobId != null) tutorialStore.setDraftJobId(jobId);
    tutorialStore.setResumeState({
      stage: "normalization",
      step: wizard.currentStep,
      // ステップ種別・対象名も同期し、ガイドが「今どの入力か」を名指しで案内できるようにする。
      stepType: wizard.currentStepConfig.type,
      stepTitle: wizard.currentStepConfig.title,
    });
  }, [
    tutorialPhase,
    tutorialStage,
    jobId,
    wizard.currentStep,
    wizard.currentStepConfig,
  ]);

  // 下書きjobを作成（intro→settingsに進む時）
  const handleCreateDraft = useCallback(async (): Promise<number> => {
    const data = form.getValues();
    const result = await window.ipcRenderer.invoke("createDraftJob", {
      parameters: {
        parameterType: "preprocess",
        settings: data.settings,
        data: data.data,
        manuallySkippedSteps: Array.from(wizard.manuallySkippedSteps),
      } satisfies DraftPreprocessParameters,
    });

    setJobId(result.jobId);
    notifyJobChanged();

    rendererLogger.info("Draft job created", {
      jobId: result.jobId,
      isExisting: result.isExisting,
    });

    return result.jobId;
  }, [form, wizard.manuallySkippedSteps]);

  // 自動保存（次へ進む時）
  const handleAutoSave = useCallback(async (): Promise<void> => {
    if (!jobId) return;

    const data = form.getValues();
    await window.ipcRenderer.invoke("updateDraftJob", {
      id: jobId,
      parameters: {
        parameterType: "preprocess",
        settings: data.settings,
        data: data.data,
        manuallySkippedSteps: Array.from(wizard.manuallySkippedSteps),
      } satisfies DraftPreprocessParameters,
    });
    notifyJobChanged();

    rendererLogger.debug("Draft job auto-saved", { jobId });
  }, [jobId, form, wizard.manuallySkippedSteps]);

  // 次へ進む（自動保存付き）
  const handleNext = useCallback(async (): Promise<void> => {
    const nextStep = wizard.currentStep + 1;

    // 最初のステップ（intro）かつjobIdがない場合は下書きを作成
    if (wizard.isFirstStep && !jobId) {
      const newJobId = await handleCreateDraft();
      // URLにステップを含めて更新（リマウント時に復元できるように）
      navigate(`/normalization/create/${newJobId}?step=${nextStep}`, {
        replace: true,
      });
    } else if (jobId) {
      // jobIdがある場合は自動保存
      await handleAutoSave();
      // URLにステップを含めて更新
      navigate(`/normalization/create/${jobId}?step=${nextStep}`, {
        replace: true,
      });
    }

    wizard.goNext();
  }, [wizard, jobId, handleCreateDraft, handleAutoSave, navigate]);

  // 前へ戻る（URL更新付き）
  const handlePrev = useCallback((): void => {
    const prevStep = wizard.currentStep - 1;
    if (jobId && prevStep >= 0) {
      navigate(`/normalization/create/${jobId}?step=${prevStep}`, {
        replace: true,
      });
    }
    wizard.goPrev();
  }, [wizard, jobId, navigate]);

  // フォーム変更時の自動保存（subscribe APIを使用）
  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        window.ipcRenderer
          .invoke("updateDraftJob", {
            id: jobId,
            parameters: {
              parameterType: "preprocess",
              settings: values.settings,
              data: values.data,
              manuallySkippedSteps: Array.from(wizard.manuallySkippedSteps),
            } satisfies DraftPreprocessParameters,
          })
          .then(() => {
            // mutate: useFetchJob (SWRImmutable) のキャッシュを無効化 — 同 wizard 再 mount 時の復元用
            // notifyJobChanged: 一覧系 pub/sub hook (useFetchDraftJob 等) に再取得を通知
            // 両者は別 hook を対象にしており重複ではない (ADR-0020)
            void mutate({ id: jobId, key: "useFetchJob" });
            notifyJobChanged();
            rendererLogger.debug("Draft auto-saved on form change", { jobId });
          })
          .catch((error: unknown) => {
            rendererLogger.error("Draft auto-save failed", error, { jobId });
          });
      },
    });

    return unsubscribe;
  }, [jobId, form, mutate, wizard.manuallySkippedSteps]);

  // スキップ状態変更時の自動保存
  useEffect(() => {
    if (!jobId) return;

    const data = form.getValues();
    window.ipcRenderer
      .invoke("updateDraftJob", {
        id: jobId,
        parameters: {
          parameterType: "preprocess",
          settings: data.settings,
          data: data.data,
          manuallySkippedSteps: Array.from(wizard.manuallySkippedSteps),
        } satisfies DraftPreprocessParameters,
      })
      .then(() => {
        // mutate / notifyJobChanged の役割は form 変更側の useEffect 内コメント参照
        void mutate({ id: jobId, key: "useFetchJob" });
        notifyJobChanged();
        rendererLogger.debug("Draft auto-saved on skip change", { jobId });
      })
      .catch((error: unknown) => {
        rendererLogger.error("Draft auto-save on skip change failed", error, {
          jobId,
        });
      });
  }, [jobId, wizard.manuallySkippedSteps, form, mutate]);

  // 下書き再開時に住所の表記ゆれチェック結果を復元
  useEffect(() => {
    if (!initialJoinCheckJobId) return;

    const restoreJoinCheckResults = async (): Promise<void> => {
      try {
        const tasks = (await window.ipcRenderer.invoke(
          "selectJobTasks",
          initialJoinCheckJobId,
        )) as SelectJobTask[];

        // JoinCheckTaskResultを持つタスクを抽出してJoinResultに変換
        const restoredResults: JoinResult[] = tasks
          .filter(
            (task): task is SelectJobTask & { result: JoinCheckTaskResult } =>
              task.result?.taskResultType === "join_check",
          )
          .map((task) => ({
            target: task.result.target as JoinCheckTarget,
            status: "complete" as const,
            unmatchedRecords: task.result.unmatchedRecords,
          }));

        if (restoredResults.length > 0) {
          setJoinRateResults(restoredResults);
          rendererLogger.info("Restored join check results from draft", {
            initialJoinCheckJobId,
            resultCount: restoredResults.length,
          });
        }
      } catch (error) {
        rendererLogger.error(
          "Failed to restore join check results",
          error as Error,
          { initialJoinCheckJobId },
        );
      }
    };

    void restoreJoinCheckResults();
  }, [initialJoinCheckJobId]);

  // 住所の表記ゆれチェックダイアログを開く
  const handleOpenJoinRateDialog = useCallback(() => {
    // ダイアログを開く時点で最新のフォームデータを取得
    const data = form.getValues().data;
    const configured: JoinCheckTarget[] = [];
    const infoMap: Partial<Record<JoinCheckTarget, DatasetInfo>> = {};

    // 水道データ情報を設定
    setWaterStatusDataset({
      path: data.water_status?.path ?? "",
      addressColumn: data.water_status?.columns?.address ?? "",
    });

    // 各データセットの設定状態とデータセット情報を構築
    if (data.resident_registry?.path) {
      configured.push("resident_registry");
      infoMap.resident_registry = {
        path: data.resident_registry.path,
        addressColumn: data.resident_registry.columns?.address ?? "",
      };
    }
    if (data.building_registry?.path) {
      configured.push("building_registry");
      infoMap.building_registry = {
        path: data.building_registry.path,
        addressColumn: data.building_registry.columns?.address ?? "",
      };
    }
    if (data.geocoding?.path) {
      configured.push("geocoding");
      infoMap.geocoding = {
        path: data.geocoding.path,
        addressColumn: data.geocoding.columns?.address ?? "",
      };
    }
    if (data.building_type_determination?.path) {
      configured.push("building_type_determination");
      infoMap.building_type_determination = {
        path: data.building_type_determination.path,
        addressColumn: data.building_type_determination.columns?.address ?? "",
      };
    }
    if (data.vacant_house?.path) {
      configured.push("vacant_house");
      infoMap.vacant_house = {
        path: data.vacant_house.path,
        addressColumn: data.vacant_house.columns?.address ?? "",
      };
    }
    if (data.optional_data_source?.path) {
      configured.push("optional_data_source");
      infoMap.optional_data_source = {
        path: data.optional_data_source.path,
        addressColumn: data.optional_data_source.columns?.address ?? "",
      };
    }

    setConfiguredDatasets(configured);
    setDatasetInfoMap(infoMap);
    setIsJoinRateDialogOpen(true);
  }, [form]);

  // 住所の表記ゆれチェックダイアログを閉じる
  const handleCloseJoinRateDialog = useCallback(() => {
    setIsJoinRateDialogOpen(false);
  }, []);

  // 住所の表記ゆれチェック結果の更新
  const handleJoinRateResultsChange = useCallback(
    (results: JoinResult[]) => {
      setJoinRateResults(results);

      // 住所の表記ゆれチェック完了後、SWRキャッシュを無効化
      // （メインプロセスでjoinCheckJobIdが更新されているため、キャッシュを更新する必要がある）
      if (jobId) {
        void mutate({ id: jobId, key: "useFetchJob" });
      }
    },
    [jobId, mutate],
  );

  // 住所の表記ゆれチェック項目の展開状態の更新
  const handleExpandedTargetsChange = useCallback(
    (expanded: Set<JoinCheckTarget>) => {
      setJoinRateExpandedTargets(expanded);
    },
    [],
  );

  // 送信処理
  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return;

    const data = form.getValues();
    // 必須データセットのファイル未選択とカラム未割当は formSchema（zod）が止める。
    // vacant_house は AIモデル構築時のみ必須。formSchema には載せず、ここで判定する。
    const isValid = await form.trigger();
    const vacantHouseMissing =
      data.settings.purpose === "model_training" &&
      !data.data.vacant_house.path;
    if (!isValid || vacantHouseMissing) {
      // 押下時に確認画面へ検証メッセージを出す（推定・モデル構築と同じ「送信を試みて初めて出る」挙動）。
      setSubmitAttempted(true);
      rendererLogger.info(
        "必須項目が未充足のため名寄せ実行をブロックしました",
        {
          componentName: "WizardContainer",
        },
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await window.ipcRenderer.invoke("execE001", {
        parameters: {
          parameterType: "preprocess",
          settings: data.settings,
          data: data.data,
        },
        // 下書きjobIdがあれば渡す（下書きからの実行）
        jobId: isDraft ? jobId : undefined,
      });

      if (result === false) {
        rendererLogger.error("名寄せ処理の開始に失敗しました", undefined, {
          componentName: "WizardContainer",
        });
        return;
      }

      // 再実行（error/complete からの新規実行）は execE001 が新しい job を作る。
      // その新 id を jobId に反映すると、draft 同期 effect が発火して
      // tutorial_state.draft_job_id を新 id に追従させる（ガイドが再実行後の処理を
      // トレースできる）。下書きフローは既に同一 id なので実質 no-op。
      if (typeof result === "number") {
        setJobId(result);
      }

      afterSubmit();
    } catch (error) {
      rendererLogger.error("名寄せ処理の開始中にエラーが発生しました", error, {
        componentName: "WizardContainer",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <WizardHeader
        effectiveCurrentStep={wizard.effectiveCurrentStep}
        effectiveSteps={wizard.effectiveSteps}
        progress={wizard.progress}
        purposeLabel={
          wizard.currentStepConfig.type === "intro"
            ? undefined
            : normalizationPurposeLabel(purpose, true)
        }
        stepTitle={wizard.currentStepConfig.title}
      />

      <div
        className={mergeClasses(
          styles.body,
          wizard.currentStepConfig.type === "intro" && styles.bodyFull,
        )}
      >
        <main className={styles.main}>
          <WizardStepRenderer
            currentStepIndex={wizard.currentStep}
            form={form}
            manuallySkippedSteps={wizard.manuallySkippedSteps}
            onGoToStep={wizard.goToStep}
            onToggleSkip={wizard.toggleManualSkip}
            stepConfig={wizard.currentStepConfig}
            submitAttempted={submitAttempted}
          />
        </main>

        {/* intro はパネルを出さない（揃えるデータは intro 本体に内包）。 */}
        {wizard.currentStepConfig.type !== "intro" && (
          <WizardSidePanel
            purpose={purpose}
            stepConfig={wizard.currentStepConfig}
          />
        )}
      </div>

      <WizardFooter
        isFirstStep={wizard.isFirstStep}
        isLastStep={wizard.isLastStep}
        isSubmitting={isSubmitting}
        onJoinRateCheck={handleOpenJoinRateDialog}
        onNext={handleNext}
        onPrev={handlePrev}
        onSubmit={handleSubmit}
      />

      {/* 住所の表記ゆれチェックダイアログ */}
      <DialogJoinCheck
        configuredDatasets={configuredDatasets}
        datasetInfoMap={datasetInfoMap}
        draftJobId={jobId}
        municipality={form.getValues().settings.municipality}
        onClose={handleCloseJoinRateDialog}
        onExpandedTargetsChange={handleExpandedTargetsChange}
        onResultsChange={handleJoinRateResultsChange}
        open={isJoinRateDialogOpen}
        previousExpandedTargets={joinRateExpandedTargets}
        previousResults={joinRateResults}
        waterStatusDataset={waterStatusDataset}
      />
    </div>
  );
};
