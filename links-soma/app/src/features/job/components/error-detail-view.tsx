/**
 * エラー詳細の表示（FR006 / #1786）。
 *
 * 失敗時に「どう対応するか（対応区分）」「具体的な手順」「修正方法」を職員向けに示す。
 * 推定/モデル構築（ErrorJobTaskInfo）と名寄せ（PostErrorBanner）の両面で共通利用し、
 * 文言を一元化する。対応区分は色だけでなくテキストでも示す（色だけに依存しない情報伝達）。
 */

import { Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { lang } from "../../../shared/config/lang";
import type { ErrorDetail } from "../../../shared/types/job-task-result";
import { FixGuideView } from "./fix-guide-view";

const t = lang.components.errorDisplay;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
    marginTop: tokens.spacingVerticalXXS,
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
  },
  // 対応区分のチップ。カテゴリはテキストで示すため色は中立グレー。薄ピンクのエラーボックス上でも
  // 沈まないよう、やや濃いグレー面＋枠線で明確に区切る。文字色を明示し赤を継がない。
  actionChip: {
    backgroundColor: tokens.colorNeutralBackground5,
    color: tokens.colorNeutralForeground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
  },
});

export const ErrorDetailView = ({
  detail,
}: {
  detail: ErrorDetail;
}): JSX.Element => {
  const styles = useStyles();
  const actionText = t.action[detail.responsibility] ?? detail.responsibility;
  return (
    <div className={styles.root}>
      <div className={styles.actionRow}>
        <Caption1>{t.actionLabel}</Caption1>
        <span className={styles.actionChip}>{actionText}</span>
      </div>
      <Caption1>{detail.next_action}</Caption1>
      {detail.fix_guide && <FixGuideView guide={detail.fix_guide} />}
    </div>
  );
};
