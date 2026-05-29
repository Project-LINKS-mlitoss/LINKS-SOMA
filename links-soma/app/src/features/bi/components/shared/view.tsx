import { useRef } from "react";
import {
  Caption1Strong,
  Card,
  CardHeader,
  type CardProps,
  makeStyles,
  mergeClasses,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { useSearchParams } from "react-router-dom";
import { type SelectResultView } from "../../../../db/schema";
import { THEME_COLORS } from "../../../../shared/config/theme-colors";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { type View } from "../../types/models/view";
import { type ChartExportHandle } from "../../types/chart-export";
import { useViewContainer, useWorkbookIdsSearchQuery } from "../../hooks";
import { DialogExportMessage } from "../../../../shared/components/dialog-export-message";
import { ViewStyle } from "./view-style";
import { ViewActionMenu } from "./view-action-menu";

type Props = {
  resultView: SelectResultView;
  className?: string;
  isPreview?: boolean;
  cardProps?: CardProps;
};

const useStyles = makeStyles({
  selected: {
    border: `2px solid ${THEME_COLORS.primary}`,
  },
  cardSurface: {
    border: `2px solid transparent`,
    transition: "border,background-color 0.2s",
    boxShadow: tokens.shadow16,
    // border分を引いている
    padding: `calc(${tokens.spacingHorizontalXXL} - 2px) calc(${tokens.spacingVerticalXXL} - 2px)`,
    gap: 0,
  },
  cardHeaderActions: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
  title: {
    minHeight: "22px",
  },
  dialogContent: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  dropdown: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    "& > label": {
      fontSize: "12px",
    },
  },
  emptyMessage: {
    padding: tokens.spacingVerticalXL,
    textAlign: "center",
  },
});

/** ビュー内の共通のステートを扱う */
export const ViewContainer = ({
  resultView,
  className,
  isPreview = false,
}: Props): JSX.Element => {
  const styles = useStyles();

  const { viewId } = useWorkbookIdsSearchQuery();
  const selected = String(resultView.id) === viewId;

  const [searchParams, setSearchParams] = useSearchParams();

  const handleClick = (): void => {
    //** 下の階層のコンポーネントでnavigateを利用した時に衝突するためクエリを直接更新する */
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sheetId", resultView.sheet_id?.toString() || "");
    newParams.set("viewId", resultView?.id.toString() || "");

    setSearchParams(newParams);
  };

  const { handleDelete, handleDownload, isInvalidParameters } =
    useViewContainer({
      resultView,
    });

  const exportMessageDialogState = useDialogState();

  // チャートビューかどうかを判定
  const isChartView = ["pie", "bar", "line"].includes(resultView.style ?? "");

  // チャートビューへのref
  const chartExportRef = useRef<ChartExportHandle>(null);

  return (
    <Card
      className={mergeClasses(
        styles.cardSurface,
        selected && styles.selected,
        className,
      )}
      onClick={isPreview ? handleClick : undefined}
    >
      <CardHeader
        action={
          <ViewActionMenu
            hasDataSetResultId={!!resultView.data_set_result_id}
            onChartCsvExport={
              isChartView
                ? async () => {
                    await chartExportRef.current?.exportCsv();
                  }
                : undefined
            }
            onDelete={handleDelete}
            onDownload={(fileType, coordinate) =>
              handleDownload(fileType, coordinate).then(() => {
                exportMessageDialogState.setIsOpen(true);
              })
            }
          />
        }
        header={
          <Subtitle2 className={styles.title}>
            {resultView.title ?? ""}
          </Subtitle2>
        }
      />
      {isInvalidParameters ? (
        <div className={styles.emptyMessage}>
          <Caption1Strong>
            パラメーターの値を正しく設定してください
          </Caption1Strong>
        </div>
      ) : resultView.unit && resultView.data_set_result_id ? (
        <ViewStyle
          ref={chartExportRef}
          isPreview={isPreview}
          view={
            {
              id: resultView.id,
              dataSetResultId: resultView.data_set_result_id,
              style: resultView.style,
              unit: resultView.unit,
              title: resultView.title,
              parameters: resultView.parameters,
            } as View /* DB型(Parameter[])とView型のparametersが構造的に不一致のためキャスト */
          }
        />
      ) : (
        <div className={styles.emptyMessage}>
          <Caption1Strong>データセットが選択されていません</Caption1Strong>
        </div>
      )}
      <DialogExportMessage dialogState={exportMessageDialogState} />
    </Card>
  );
};
