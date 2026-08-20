import {
  Card,
  makeStyles,
  tokens,
  Tooltip,
  Divider,
} from "@fluentui/react-components";
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
import { type NormalizationPurpose } from "../../normalization/hooks/use-form-normalization";

// 名寄せウィザードを AIモデル構築 選択済みで開く導線。
const MODEL_TRAINING_PURPOSE: NormalizationPurpose = "model_training";

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
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  // モデルを得る操作（構築・アップロード）と、上流の学習データを準備する名寄せ導線を分ける境界。
  groupDivider: {
    height: "20px",
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
          <Divider className={styles.groupDivider} vertical />
          <Tooltip
            content="モデルに学習させるためのデータを名寄せ処理で作成します"
            relationship="description"
            withArrow
          >
            <Button
              onClick={() => {
                // 名寄せ一覧経由で下書き確認をはさむ（進行中の下書きの黙示的な上書きを防ぐ）。
                navigate(
                  `${ROUTES.NORMALIZATION.ROOT}?newPurpose=${MODEL_TRAINING_PURPOSE}`,
                );
              }}
              size="small"
            >
              名寄せ処理から始める
            </Button>
          </Tooltip>
        </div>

        <TableModel />
      </Card>

      <Card className={styles.content}>
        <TableJobsByType jobType="ml" />
      </Card>
    </div>
  );
}
