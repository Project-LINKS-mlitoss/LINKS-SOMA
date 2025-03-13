import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { ButtonCreateModel } from "../../components/button-create-model";
import { TableModel } from "../../components/table-model";
import { TableJobsByType } from "../../components/table-jobs-by-type";
import { BreadcrumbBase, BreadcrumbItem } from "../../components/ui/breadcrumb";
import { ROUTES } from "../../routes";

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
});

export function Model(): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "モデル管理",
            current: true,
            href: ROUTES.MODEL.ROOT,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>モデル構築</h2>

      <Card className={styles.content}>
        <ButtonCreateModel />

        <TableModel />

        <TableJobsByType jobType="ml" />
      </Card>
    </div>
  );
}
