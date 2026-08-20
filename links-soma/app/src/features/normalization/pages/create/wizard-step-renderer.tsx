/**
 * ウィザードステップレンダラーコンポーネント
 * 現在のステップに応じたコンテンツを表示
 */

import { makeStyles, tokens } from "@fluentui/react-components";
import { type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { resolveReferences } from "../../pre-validation";
import { type WizardStepConfig } from "./wizard-steps";
import { WizardStepSettings } from "./wizard-step-settings";
import { WizardStepDataset } from "./wizard-step-dataset";
import { WizardStepConfirmation } from "./wizard-step-confirmation";
import { WizardStepIntro } from "./wizard-step-intro";
import { WizardStepValidation } from "./wizard-step-validation";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingVerticalL} 0`,
  },
});

type Props = {
  /** 現在のステップ設定 */
  stepConfig: WizardStepConfig;
  /** 現在のステップインデックス */
  currentStepIndex: number;
  /** フォーム */
  form: UseFormReturn<FormNormalizationType>;
  /** 手動スキップしたステップ */
  manuallySkippedSteps: Set<number>;
  /** 手動スキップの切り替え */
  onToggleSkip: (stepIndex: number, isSkipped: boolean) => void;
  /** 指定したステップへ移動 */
  onGoToStep: (stepIndex: number) => void;
  /** 「開始する」押下で必須未充足ブロックしたか（確認画面の検証表示トリガー） */
  submitAttempted: boolean;
};

export const WizardStepRenderer = ({
  stepConfig,
  currentStepIndex,
  form,
  manuallySkippedSteps,
  onToggleSkip,
  onGoToStep,
  submitAttempted,
}: Props): JSX.Element => {
  const styles = useStyles();

  const renderStepContent = (): JSX.Element | null => {
    switch (stepConfig.type) {
      case "intro":
        return <WizardStepIntro form={form} />;

      case "settings":
        return <WizardStepSettings form={form} />;

      case "dataset": {
        // 選択ファイル・カラムマッピングをデータチェックに渡す（実カラム名の解決元）
        const data = form.watch("data");
        const datasetValue = data?.[
          stepConfig.schemaKey as keyof FormNormalizationType["data"]
        ] as { path?: string; columns?: Record<string, string> } | undefined;
        // クロスファイル参照（PV-08）。親データセットの path/実カラムを解決して渡す。
        const references = resolveReferences(
          stepConfig.schemaKey ?? "",
          (data ?? {}) as Record<
            string,
            { path?: string; columns?: Record<string, string> }
          >,
        );
        return (
          <>
            <WizardStepDataset
              key={stepConfig.schemaKey}
              form={form}
              isSkipped={manuallySkippedSteps.has(currentStepIndex)}
              onToggleSkip={(isSkipped) =>
                onToggleSkip(currentStepIndex, isSkipped)
              }
              stepConfig={stepConfig}
            />
            {/* 事前バリデーション。フォームの下に軽量チェック結果を提示（FR004-007）。 */}
            <WizardStepValidation
              columns={datasetValue?.columns}
              filename={datasetValue?.path}
              references={references}
              schemaKey={stepConfig.schemaKey}
            />
          </>
        );
      }

      case "confirmation":
        return (
          <WizardStepConfirmation
            form={form}
            manuallySkippedSteps={manuallySkippedSteps}
            onGoToStep={onGoToStep}
            submitAttempted={submitAttempted}
          />
        );

      default:
        return null;
    }
  };

  return <div className={styles.container}>{renderStepContent()}</div>;
};
