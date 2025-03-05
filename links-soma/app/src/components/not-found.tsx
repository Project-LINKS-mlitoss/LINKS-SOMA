import { makeStyles, tokens } from "@fluentui/react-components";
import { Button } from "./ui/button";

const useStyles = makeStyles({
  root: {
    overflow: "hidden",
    display: "flex",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    flex: "1",
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  footer: {
    padding: `${tokens.spacingVerticalM} 0`,
  },
});

export const NotFound = (): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.content}>
      <h2 className={styles.heading}>404 Not Found</h2>
      <p>ページが見つかりませんでした。</p>

      <div className={styles.footer}>
        <Button as="a" href="#/">
          分析画面へ
        </Button>
      </div>
    </div>
  );
};
