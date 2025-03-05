import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
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

export function Normalization(): JSX.Element {
  const styles = useStyles();
  const navigator = useNavigate();

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "名寄せ処理",
            current: true,
            href: ROUTES.NORMALIZATION.ROOT,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>名寄せ処理</h2>

      <Card className={styles.content}>
        <Button
          icon={
            <AddFilled
              color={tokens.colorNeutralForeground1}
              fontSize={tokens.fontSizeBase400}
              strokeWidth={2}
            />
          }
          onClick={() => {
            navigator("/normalization/create");
          }}
          size="small"
        >
          名寄せ処理を始める
        </Button>

        <TableJobsByType jobType="preprocess" />
      </Card>
    </div>
  );
}
