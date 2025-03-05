import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { ButtonCreateWorkbook } from "../../../components/button-create-workbook";
import { TableWorkbook } from "../../../components/table-workbook";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../components/ui/breadcrumb";
import { ROUTES } from "../../../routes";

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

export function Workbook(): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "分析",
            current: true,
            href: ROUTES.ANALYSIS.WORKBOOK,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>分析</h2>
      <Card className={styles.content}>
        <ButtonCreateWorkbook />
        <TableWorkbook />
      </Card>
    </div>
  );
}
