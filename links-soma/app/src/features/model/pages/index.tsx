import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { ButtonCreateModel } from "../components/button-create-model";
import { TableModel } from "../components/table-model";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
} from "../../../shared/components/ui";
import { TableJobsByType } from "../../job/components/table-jobs-by-type";
import { ROUTES } from "../../../shared/config/routes";

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
  buttonRow: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
});

export function Model(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "モデル構築",
            current: true,
            href: ROUTES.MODEL.ROOT,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>モデル構築</h2>

      <Card className={styles.content}>
        <div className={styles.buttonRow}>
          <Button
            icon={
              <AddFilled
                color={tokens.colorNeutralForeground1}
                fontSize={tokens.fontSizeBase400}
                strokeWidth={2}
              />
            }
            onClick={() => {
              navigate(ROUTES.MODEL.CREATE);
            }}
            size="small"
          >
            モデル構築を始める
          </Button>
          <ButtonCreateModel />
        </div>

        <TableModel />
      </Card>

      <Card className={styles.content}>
        <TableJobsByType jobType="ml" />
      </Card>
    </div>
  );
}
