import { makeStyles, tokens } from "@fluentui/react-components";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/sidebar";
import { SIDEBAR_WIDTH } from "../config/layout-constants";

const useStyles = makeStyles({
  root: {
    overflow: "hidden",
    display: "flex",
    paddingLeft: SIDEBAR_WIDTH,
  },
  content: {
    flex: "1",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    backgroundColor: tokens.colorNeutralBackground3,
    minHeight: "100vh",
  },
});

export function Layout(): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
