import { makeStyles, tokens } from "@fluentui/react-components";
import { useRouteError } from "react-router-dom";
import { Sidebar } from "../components/sidebar";
import { SIDEBAR_WIDTH } from "../config/layout-constants";
import { rendererLogger } from "../utils/renderer-logger";

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
    marginLeft: SIDEBAR_WIDTH,
    height: "100vh",
  },
});

export function Error(): JSX.Element {
  const styles = useStyles();

  const error = useRouteError();
  rendererLogger.error("Application route error", error, { page: "error" });

  return (
    <div className={styles.root} id="error-page">
      <Sidebar />
      <div className={styles.content}>
        <h2 className={styles.heading}>アプリケーションエラー</h2>
        <p>予期せぬエラーが発生しました</p>
        <p>
          <i>
            {(error as { statusText?: string }).statusText ||
              (error as { message?: string }).message}
          </i>
        </p>
      </div>
    </div>
  );
}
