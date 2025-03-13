import {
  Button,
  Card,
  makeStyles,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { BreadcrumbBase, BreadcrumbItem } from "../../components/ui/breadcrumb";
import { ROUTES } from "../../routes";
import { DebugCreateDatasets } from "./_debug-create-datasets";
import { DummyDataButtons } from "./_dummy_data_buttons";
import { DebugCreateButtons } from "./_debug-create-buttuns";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flexDirection: "column",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    gap: tokens.spacingVerticalXL,
  },

  container: {
    display: "grid",
    gap: tokens.spacingVerticalL,
  },
});

export function Debug(): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "開発者向け",
            current: true,
            href: ROUTES.DEBUG,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>開発者向け</h2>

      <div className={styles.container}>
        <Card>
          <Subtitle2>分析</Subtitle2>
          <DebugCreateDatasets />
        </Card>

        <Card>
          <Subtitle2>モデル構築</Subtitle2>
          <div>
            <Button
              onClick={() => {
                window.ipcRenderer
                  .invoke("_debugInsertModelFiles")
                  .catch(console.error);
              }}
              size="small"
            >
              作成(debug)
            </Button>
          </div>
        </Card>
        <Card>
          <Subtitle2>データセット管理</Subtitle2>
          <DummyDataButtons />
        </Card>

        <Card>
          <Subtitle2>処理一覧</Subtitle2>
          <DebugCreateButtons />
        </Card>
      </div>
    </div>
  );
}
