/**
 * ウィザードステップレンダラーコンポーネント
 * 現在のステップに応じたコンテンツを表示
 */

import { makeStyles, tokens } from "@fluentui/react-components";
import { type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { type WizardStepConfig } from "./wizard-steps";
import { WizardStepSettings } from "./wizard-step-settings";
import { WizardStepDataset } from "./wizard-step-dataset";
import { WizardStepConfirmation } from "./wizard-step-confirmation";
import { WizardStepIntro } from "./wizard-step-intro";

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
};

export const WizardStepRenderer = ({
  stepConfig,
  currentStepIndex,
  form,
  manuallySkippedSteps,
  onToggleSkip,
  onGoToStep,
}: Props): JSX.Element => {
  const styles = useStyles();

  const renderStepContent = (): JSX.Element | null => {
    switch (stepConfig.type) {
      case "intro":
        return <WizardStepIntro />;

      case "settings":
        return <WizardStepSettings form={form} />;

      case "dataset":
        return (
          <WizardStepDataset
            key={stepConfig.schemaKey}
            form={form}
            isSkipped={manuallySkippedSteps.has(currentStepIndex)}
            onToggleSkip={(isSkipped) =>
              onToggleSkip(currentStepIndex, isSkipped)
            }
            stepConfig={stepConfig}
          />
        );

      case "confirmation":
        return (
          <WizardStepConfirmation
            form={form}
            manuallySkippedSteps={manuallySkippedSteps}
            onGoToStep={onGoToStep}
          />
        );

      default:
        return null;
    }
  };

  return <div className={styles.container}>{renderStepContent()}</div>;
};
