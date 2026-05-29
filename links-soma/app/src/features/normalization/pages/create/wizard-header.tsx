/**
 * ウィザードヘッダーコンポーネント
 * プログレスバーとステップタイトルを表示
 */

import {
  makeStyles,
  ProgressBar,
  tokens,
  Caption1,
  Subtitle2,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  header: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalL} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  progressContainer: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  progressBar: {
    flex: 1,
  },
  // Caption1のデフォルト色と異なるため色のみ指定
  stepIndicator: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  // Subtitle2にmarginリセットを追加
  stepTitle: {
    margin: 0,
  },
});

type Props = {
  /** 有効なステップでの現在位置（0始まり） */
  effectiveCurrentStep: number;
  /** 有効なステップ数 */
  effectiveSteps: number;
  /** プログレス（0-100） */
  progress: number;
  /** ステップタイトル */
  stepTitle: string;
};

export const WizardHeader = ({
  effectiveCurrentStep,
  effectiveSteps,
  progress,
  stepTitle,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <header className={styles.header}>
      <div className={styles.progressContainer}>
        <ProgressBar
          className={styles.progressBar}
          max={100}
          value={progress}
        />
        <Caption1 className={styles.stepIndicator}>
          Step {effectiveCurrentStep + 1}/{effectiveSteps}
        </Caption1>
      </div>
      <Subtitle2 as="h3" className={styles.stepTitle}>
        {stepTitle}
      </Subtitle2>
    </header>
  );
};
