import { makeStyles } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    height: "400px",
  },
});

export const LoadingChart = (): JSX.Element => {
  const styles = useStyles();
  return <div className={styles.root}></div>;
};
