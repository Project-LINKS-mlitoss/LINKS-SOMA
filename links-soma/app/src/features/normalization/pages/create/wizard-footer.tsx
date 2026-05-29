/**
 * ウィザードフッターコンポーネント
 * 「戻る」「次へ」ボタンを表示
 * 確認画面では「住所の表記ゆれチェック」ボタンも表示
 */

import { makeStyles, tokens } from "@fluentui/react-components";
import {
  ChevronLeft20Regular,
  ChevronRight20Regular,
  DataUsage20Regular,
} from "@fluentui/react-icons";
import { Button } from "../../../../shared/components/ui";
import { SIDEBAR_WIDTH } from "../../../../shared/config/layout-constants";

const useStyles = makeStyles({
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    position: "fixed",
    bottom: 0,
    left: SIDEBAR_WIDTH,
    right: 0,
  },
  buttonGroup: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
});

type Props = {
  /** 最初のステップかどうか */
  isFirstStep: boolean;
  /** 最後のステップかどうか */
  isLastStep: boolean;
  /** 「戻る」ボタンのクリックハンドラ */
  onPrev: () => void;
  /** 「次へ」ボタンのクリックハンドラ */
  onNext: () => void;
  /** 「開始する」ボタンのクリックハンドラ（最後のステップ用） */
  onSubmit?: () => void;
  /** 送信中かどうか */
  isSubmitting?: boolean;
  /** 「住所の表記ゆれチェック」ボタンのクリックハンドラ（最後のステップ用） */
  onJoinRateCheck?: () => void;
};

export const WizardFooter = ({
  isFirstStep,
  isLastStep,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting = false,
  onJoinRateCheck,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <footer className={styles.footer}>
      <div>
        {!isFirstStep && (
          <Button
            appearance="outline"
            disabled={isSubmitting}
            icon={<ChevronLeft20Regular />}
            onClick={onPrev}
          >
            戻る
          </Button>
        )}
      </div>
      <div className={styles.buttonGroup}>
        {/* 確認画面で住所の表記ゆれチェックボタンを表示 */}
        {isLastStep && onJoinRateCheck && (
          <Button
            appearance="outline"
            disabled={isSubmitting}
            icon={<DataUsage20Regular />}
            onClick={onJoinRateCheck}
          >
            住所の表記ゆれチェック
          </Button>
        )}
        {isLastStep ? (
          <Button
            appearance="primary"
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? "処理中..." : "開始する"}
          </Button>
        ) : (
          <Button
            appearance="primary"
            icon={<ChevronRight20Regular />}
            iconPosition="after"
            onClick={onNext}
          >
            次へ
          </Button>
        )}
      </div>
    </footer>
  );
};
