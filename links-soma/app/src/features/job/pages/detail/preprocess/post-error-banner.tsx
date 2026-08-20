/**
 * 事後エラー表示: 失敗バナー＋エラー一覧（FR004-007）。
 *
 * 名寄せ処理が失敗したとき、処理結果画面に表示する。job_tasks の実エラー
 * （error_msg）に、責任分界・次アクション（result.error_detail / FR006）を添えて
 * 1 件ずつ構造化する。淡い赤背景・赤文字のエラーボックスで雰囲気を統一する。
 *
 * データ出所は実 DB（useFetchJobTasks → IPC selectJobTasks）。エラーコードを記録した
 * job_task が無い場合（一般 except でジョブのみ error 化した等）は「不明のエラー」を出す。
 */

import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { lang } from "../../../../../shared/config/lang";
import { THEME_COLORS } from "../../../../../shared/config/theme-colors";
import { ErrorDetailView } from "../../../components/error-detail-view";
import { useFetchJobTasks } from "../../../hooks/use-fetch-job-tasks";

const useStyles = makeStyles({
  box: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusSmall,
    // 既存のエラー表示と同じ淡い赤背景・赤文字。
    backgroundColor: "rgba(196, 49, 75, 0.08)",
    color: THEME_COLORS.error,
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
    // 既定の箇条書き（•）を踏襲。
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

export const PostErrorBanner = ({ jobId }: Props): JSX.Element => {
  const styles = useStyles();
  const { data } = useFetchJobTasks({ jobId });

  const tasks = data ?? [];
  const errorTasks = tasks.filter((task) => task.error_msg);

  return (
    <div className={styles.box}>
      <span className={styles.title}>{lang.components.errorDisplay.postErrorTitle}</span>
      {errorTasks.length === 0 ? (
        <Caption1Strong>不明のエラーが発生しました</Caption1Strong>
      ) : (
        <ul className={styles.list}>
          {errorTasks.map((task) => {
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
      )}
    </div>
  );
};
