import { Caption1, makeStyles, tokens } from "@fluentui/react-components";
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
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  url: {
    fontSize: tokens.fontSizeBase300,
    padding: `${tokens.spacingVerticalL}`,
    margin: `${tokens.spacingVerticalM} 0`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  footer: {
    padding: `${tokens.spacingVerticalM} 0`,
  },
});

export const NotFound = (): JSX.Element => {
  const styles = useStyles();
  const path = window.location.hash;

  return (
    <div className={styles.content}>
      <h2 className={styles.heading}>404 Not Found</h2>
      <p>ページが見つかりませんでした。</p>
      {path && (
        <div className={styles.url}>
          <Caption1>アクセスしようとしたリソース:</Caption1>
          <br />
          <code>{path}</code>
        </div>
      )}

      <div className={styles.footer}>
        <Button as="a" href="#/">
          分析画面へ
        </Button>
      </div>
    </div>
  );
};
