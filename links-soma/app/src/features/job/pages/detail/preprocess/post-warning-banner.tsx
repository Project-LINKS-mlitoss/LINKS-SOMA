/**
 * 事後警告表示: 名寄せは成功したが確認事項がある場合のバナー（FR004-007）。
 *
 * ジョブは失敗していない（status="complete"）が、一部の入力データが推定に活かせなかった
 * ケース（例: 水道使用量が推定基準日から遡る1年を被覆せず特徴量が使われない E-0020）を、処理結果画面に
 * 淡い琥珀色のバナーで示す。失敗（PostErrorBanner・赤）と視覚的に区別する。
 *
 * データ出所は失敗バナーと同じ実 job_tasks（error_msg を持つタスク）。責任分界・次アクション・
 * 修正方法（result.error_detail / FR006）を ErrorDetailView で共通表示する。
 */

import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { lang } from "../../../../../shared/config/lang";
import { THEME_COLORS } from "../../../../../shared/config/theme-colors";
import { ErrorDetailView } from "../../../components/error-detail-view";
import { useFetchJobTasks } from "../../../hooks/use-fetch-job-tasks";

const t = lang.components.errorDisplay;

const useStyles = makeStyles({
  box: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusSmall,
    // 失敗（赤）と区別する淡い琥珀色の背景・文字。
    backgroundColor: THEME_COLORS.warningBackground,
    color: THEME_COLORS.warning,
  },
  title: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalXL,
  },
  item: {
    listStyleType: "disc",
  },
  itemHead: {
    display: "flex",
    alignItems: "baseline",
    columnGap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
  },
});

type Props = {
  jobId: number;
};

export const PostWarningBanner = ({ jobId }: Props): JSX.Element | null => {
  const styles = useStyles();
  const { data } = useFetchJobTasks({ jobId });

  const warningTasks = (data ?? []).filter((task) => task.error_msg);
  // 確認事項が無ければ何も出さない（成功時の通常表示を汚さない）。
  if (warningTasks.length === 0) return null;

  return (
    <div className={styles.box}>
      <span className={styles.title}>{t.postWarningTitle}</span>
      <ul className={styles.list}>
        {warningTasks.map((task) => {
          const errorDetail = task.result?.error_detail;
          return (
            <li key={task.id} className={styles.item}>
              <span className={styles.itemHead}>
                <Caption1Strong>{task.error_msg}</Caption1Strong>
              </span>
              {errorDetail && <ErrorDetailView detail={errorDetail} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
