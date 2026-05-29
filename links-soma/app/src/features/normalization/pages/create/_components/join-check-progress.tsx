/**
 * 住所の表記ゆれチェック進捗表示コンポーネント
 *
 * @description
 * - チェック実行中の進捗状況を表示
 * - 各データセットの処理状態（待機中/実行中/完了/エラー）を可視化
 */

import {
  makeStyles,
  tokens,
  Spinner,
  Caption1,
  Body1Strong,
  Badge,
} from "@fluentui/react-components";
import {
  Checkmark16Regular,
  Clock16Regular,
  ErrorCircle16Regular,
} from "@fluentui/react-icons";
import { type JoinResult, CHECK_TARGETS } from "./types-join-check";

const useStyles = makeStyles({
  progressContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalM,
  },
  progressHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
  },
  progressCount: {
    color: tokens.colorNeutralForeground3,
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  taskItem: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  taskItemRunning: {
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  taskItemComplete: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  taskItemError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
  },
  taskStatusIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
  },
  taskStatusRunning: {
    color: tokens.colorBrandForeground1,
  },
  taskStatusComplete: {
    color: tokens.colorPaletteGreenForeground1,
  },
  taskStatusPending: {
    color: tokens.colorNeutralForeground4,
  },
  taskStatusError: {
    color: tokens.colorPaletteRedForeground1,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
});

type Props = {
  /** 各データセットの結果 */
  results: JoinResult[];
};

export const JoinCheckProgress = ({ results }: Props): JSX.Element => {
  const styles = useStyles();

  const completedCount = results.filter((r) => r.status === "complete").length;

  return (
    <div className={styles.progressContainer}>
      {/* 進捗ヘッダー */}
      <div className={styles.progressHeader}>
        <Spinner size="small" />
        <Body1Strong>住所の表記ゆれチェックを実行しています...</Body1Strong>
        <Caption1 className={styles.progressCount}>
          ({completedCount}/{results.length}件完了)
        </Caption1>
      </div>

      {/* タスクリスト */}
      <div className={styles.taskList}>
        {results.map((result) => {
          const targetInfo = CHECK_TARGETS.find((t) => t.key === result.target);
          const taskClass =
            result.status === "running"
              ? `${styles.taskItem} ${styles.taskItemRunning}`
              : result.status === "complete"
                ? `${styles.taskItem} ${styles.taskItemComplete}`
                : result.status === "error"
                  ? `${styles.taskItem} ${styles.taskItemError}`
                  : styles.taskItem;

          return (
            <div key={result.target} className={taskClass}>
              <span className={styles.taskStatusIcon}>
                {result.status === "running" && (
                  <Spinner className={styles.taskStatusRunning} size="tiny" />
                )}
                {result.status === "complete" && (
                  <Checkmark16Regular className={styles.taskStatusComplete} />
                )}
                {result.status === "pending" && (
                  <Clock16Regular className={styles.taskStatusPending} />
                )}
                {result.status === "error" && (
                  <ErrorCircle16Regular className={styles.taskStatusError} />
                )}
              </span>
              <Caption1>{targetInfo?.label}</Caption1>
              {result.status === "complete" && (
                <Badge appearance="filled" color="success" size="small">
                  完了
                </Badge>
              )}
              {result.status === "error" && (
                <Badge appearance="filled" color="danger" size="small">
                  エラー
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <Caption1 className={styles.hint}>
        データ量によっては数分かかる場合があります
      </Caption1>
    </div>
  );
};
