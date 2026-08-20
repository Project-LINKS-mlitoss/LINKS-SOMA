import { useRef } from "react";
import {
  Caption1,
  Caption1Strong,
  Card,
  CardHeader,
  type CardProps,
  makeStyles,
  mergeClasses,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { useSearchParams } from "react-router-dom";
import { type SelectResultView } from "../../../../db/schema";
import { THEME_COLORS } from "../../../../shared/config/theme-colors";
import { lang } from "../../../../shared/config/lang";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { type View } from "../../types/models/view";
import { type ChartExportHandle } from "../../types/chart-export";
import {
  useFetchPositionedBuildingCount,
  useViewContainer,
  useWorkbookIdsSearchQuery,
} from "../../hooks";
import { DialogExportMessage } from "../../../../shared/components/dialog-export-message";
import { ViewStyle } from "./view-style";
import { ViewActionMenu } from "./view-action-menu";

type Props = {
  resultView: SelectResultView;
  className?: string;
  isPreview?: boolean;
  cardProps?: CardProps;
};

/**
 * このビュー設定が建物の位置情報を前提とするか。
 * 地図(map-with-table)と地域集計(unit=area)は、建物→地域の割当てや地図描画に
 * 建物の座標を要する。建物単位の表・グラフ(pie/line)は属性のみで成立する。
 * 分岐は view-style.tsx の (style, unit) 分岐に対応。
 */
const requiresPositionedBuildings = (
  style: SelectResultView["style"],
  unit: SelectResultView["unit"],
): boolean => style === "map-with-table" || unit === "area";

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
  // 位置情報が必要なビューの控えめな注意（エラーではなく前提案内）。内容の上に薄く出す。
  positionNotice: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    marginBottom: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  positionNoticeHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  // 情報アイコンは警告色にしない（エラーではなく前提案内）。中立のグレー。
  positionNoticeIcon: {
    color: tokens.colorNeutralForeground3,
  },
  positionNoticeBody: {
    color: tokens.colorNeutralForeground3,
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

  // 位置情報を前提とするビュー（地図 / 地域集計）で、測位済み建物が無い結果のとき、
  // 「このビューには位置情報が必要」と前提条件を案内する。判定軸は件数でなく測位の有無
  // （bldg_geometry 非NULL）なので、実測0（空き家0件）と退化0（測位なし）を取り違えない。
  const needsPosition = requiresPositionedBuildings(
    resultView.style,
    resultView.unit,
  );
  const { data: positionedBuildingCount } = useFetchPositionedBuildingCount({
    dataSetResultId: needsPosition ? resultView.data_set_result_id : null,
  });
  const lacksPositionData = needsPosition && positionedBuildingCount === 0;

  /**
   * 円グラフはラベルのグループがないと1行が1扇形になり、内訳の図として成立しない。
   * 設定が未完了なだけなのでビューは消さず、位置情報の注意と同じ形で案内だけ出す。
   */
  const lacksLabelGroup =
    resultView.style === "pie" &&
    !resultView.parameters?.some((parameter) => parameter.type === "group");

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
            resultView={resultView}
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
        <>
          {/* 位置情報が要るビュー(地図/地域集計)で測位ゼロのとき、ビューは消さず上部に控えめな
              注意だけ出す。エラーではないので操作を妨げるノイズにはしない（地図は素地図が残る）。 */}
          {lacksPositionData && (
            <div className={styles.positionNotice}>
              <div className={styles.positionNoticeHeader}>
                <Info16Regular className={styles.positionNoticeIcon} />
                <Caption1Strong>
                  {lang.components.resultView.positionRequiredTitle}
                </Caption1Strong>
              </div>
              <Caption1 className={styles.positionNoticeBody}>
                {lang.components.resultView.positionRequiredBody}
              </Caption1>
            </div>
          )}
          {lacksLabelGroup && (
            <div className={styles.positionNotice}>
              <div className={styles.positionNoticeHeader}>
                <Info16Regular className={styles.positionNoticeIcon} />
                <Caption1Strong>
                  {lang.components.resultView.pieGroupRequiredTitle}
                </Caption1Strong>
              </div>
              <Caption1 className={styles.positionNoticeBody}>
                {lang.components.resultView.pieGroupRequiredBody}
              </Caption1>
            </div>
          )}
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
        </>
      ) : (
        <div className={styles.emptyMessage}>
          <Caption1Strong>データセットが選択されていません</Caption1Strong>
        </div>
      )}
      <DialogExportMessage dialogState={exportMessageDialogState} />
    </Card>
  );
};
