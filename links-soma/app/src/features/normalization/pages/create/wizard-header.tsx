/**
 * ウィザードヘッダーコンポーネント
 * プログレスバーとステップタイトルを表示
 */

import {
  makeStyles,
  ProgressBar,
  tokens,
  Caption1,
  Caption1Strong,
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
  // ステップタイトルと目的チップを左右に配置する行。
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
  },
  // Subtitle2にmarginリセットを追加
  stepTitle: {
    margin: 0,
  },
  // 選択中の目的を常時示すチップ（どのステップを準備中か見失わせない）。
  purposeChip: {
    flexShrink: 0,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    borderRadius: tokens.borderRadiusSmall,
    whiteSpace: "nowrap",
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
  /** 選択中の目的ラベル（intro では未指定＝非表示） */
  purposeLabel?: string;
};

export const WizardHeader = ({
  effectiveCurrentStep,
  effectiveSteps,
  progress,
  stepTitle,
  purposeLabel,
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
      <div className={styles.titleRow}>
        <Subtitle2 as="h3" className={styles.stepTitle}>
          {stepTitle}
        </Subtitle2>
        {purposeLabel != null && (
          <span className={styles.purposeChip}>
            <Caption1Strong>{purposeLabel}</Caption1Strong>
          </span>
        )}
      </div>
    </header>
  );
};
