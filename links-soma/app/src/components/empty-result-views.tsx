import { Body1Stronger, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  empty: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "60vh",
  },
  emptyContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.spacingVerticalXL,
  },
  emptyImage: {
    width: "150px",
    height: "150px",
  },
  emptyText: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.spacingVerticalSNudge,
  },
});

export const EmptyResultViews = (): JSX.Element => {
  const styles = useStyles();
  return (
    <div className={styles.empty}>
      <div className={styles.emptyContainer}>
        <img alt="empty" className={styles.emptyImage} src="Graph.png" />
        <div className={styles.emptyText}>
          <Body1Stronger>表示するビューがありません。</Body1Stronger>
        </div>
      </div>
    </div>
  );
};
