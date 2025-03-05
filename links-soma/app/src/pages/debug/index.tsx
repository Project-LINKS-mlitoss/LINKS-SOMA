import { makeStyles } from "@fluentui/react-components";

const useStyles = makeStyles({
  flex: {
    display: "flex",
    flexDirection: "column",
  },
});

export function Debug(): JSX.Element {
  const styles = useStyles();
  return (
    <div>
      <h1>(開発用)</h1>
      <div className={styles.flex}>
        <a href="#">Go to home page</a>
      </div>
    </div>
  );
}
