import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  Button,
  makeStyles,
  tokens,
  type InlineDrawerProps,
  mergeClasses,
  useRestoreFocusSource,
  Switch,
  Field,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { type MapWithTableView } from "../../../types/models/view";
import { TextWithTooltip } from "../../../../../shared/components/ui";
import { lang } from "../../../../../shared/config/lang";
import { translateColumnToJapanese } from "../../../../../shared/column-translation-utils";
import { ResultTable } from "../table/result-table";
import { QueryHeader, QueryHeaderWrapper } from "../../shared/query-header";
import { resolveColorProperty } from "../../../util/map/color-column";
import { extractThresholdFromParameters } from "../../../util/threshold-column-utils";
import { ProbabilityRangeSlider } from "./probability-range-slider";
import { useProbabilityRange } from "./probability-range-slider/hooks";
import { ReferenceDateDropdown } from "./reference-date-dropdown";
import { useReferenceDateDropdown } from "./reference-date-dropdown/hooks";
import { ColorColumnControl } from "./color-column-control";
import { useColorColumnControl } from "./color-column-control/hooks";
import {
  Map,
  MapCenterButtons,
  ZoomWarningOverlay,
  useFeatureFetcher,
  useMapAllCount,
  useMapInit,
  usePopupEffectWithFeature,
  useSetMapCenterEffect,
  useViewportLayerEffect,
} from "./map-container";

const useStyles = makeStyles({
  root: {
    overflow: "hidden",
    display: "flex",
    gap: tokens.spacingHorizontalXS,
  },

  content: {
    flex: "1",
    overflow: "auto",

    position: "relative",
  },

  flexColumn: {
    flexDirection: "column",
  },

  withViewContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingVerticalXXL,
  },
  filters: {
    display: "flex",
    columnGap: tokens.spacingHorizontalXXL,
    rowGap: tokens.spacingVerticalMNudge,
    flexWrap: "wrap",
  },
  filter: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  map: {
    marginTop: tokens.spacingVerticalMNudge,
    position: "relative",
  },
  button: {
    position: "absolute",
    top: tokens.spacingVerticalMNudge,
    left: tokens.spacingHorizontalXXL,
    zIndex: 1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
  },
  indicator: {
    marginLeft: 0,
  },
  fieldMessage: {
    padding: `${tokens.spacingVerticalS} 0`,
  },
});

type DrawerTableProps = InlineDrawerProps & {
  setWithTable: (withTable: boolean) => void;
};

const DrawerTable = ({
  setWithTable,
  ...props
}: DrawerTableProps): JSX.Element => {
  const restoreFocusSourceAttributes = useRestoreFocusSource();

  return (
    <InlineDrawer
      {...restoreFocusSourceAttributes}
      {...props}
      position="end"
      style={{ width: "40%" }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => setWithTable(false)}
            />
          }
        />
      </DrawerHeader>

      <DrawerBody>{props.children}</DrawerBody>
    </InlineDrawer>
  );
};

type Props = {
  view: MapWithTableView;
  isPreview?: boolean; // プレビュー用のフラグ
};

export const ViewMapWithTable = ({ view, isPreview }: Props): JSX.Element => {
  const styles = useStyles();

  const { unit, dataSetResultId, parameters } = view;

  const mapInitState = useMapInit();

  const referenceDateDropdown = useReferenceDateDropdown({
    dataSetResultId: view.dataSetResultId,
  });
  // 最古の推定基準日。取得順に依存しないよう辞書順の最小値で求める（ISO 日付）。
  const oldestReferenceDate = referenceDateDropdown.referenceDates?.length
    ? [...referenceDateDropdown.referenceDates].sort()[0]
    : undefined;
  const { getFeatureById, getFeatureByReferenceDate } = useFeatureFetcher({
    unit,
  });

  const colorColumnControl = useColorColumnControl({
    referenceDates: referenceDateDropdown.referenceDates,
    selectedDate: referenceDateDropdown.selectedDate,
    oldestReferenceDate,
    unit,
  });

  // 絞り込みは色分けの基準と同じ量を対象にする（軸・ラベル・凡例を一致させる）
  const probabilityRangeState = useProbabilityRange({
    dataSetResultId,
    unit,
    colorColumn: colorColumnControl.colorColumn,
  });
  const activeColorProperty = resolveColorProperty(
    colorColumnControl.colorColumn,
    unit,
    extractThresholdFromParameters(view.parameters),
  ).propertyName;

  const usePopupEffectWithFeatureState = usePopupEffectWithFeature({
    mapInstance: mapInitState.mapInstance,
    view,
    getFeatureById,
    getFeatureByReferenceDate,
    selectedDate: referenceDateDropdown.selectedDate,
    oldestReferenceDate,
    domainMax: probabilityRangeState.probabilityDomainMax,
  });

  const viewportLayerEffectState = useViewportLayerEffect({
    mapInstance: mapInitState.mapInstance,
    selectedDate: referenceDateDropdown.selectedDate,
    view,
    setSelectedFeature: usePopupEffectWithFeatureState.setSelectedFeature,
    // 確率グラデーションの上限。スライダーの軸（変化率で ±50%）を渡すと
    // レイヤーが作り直され、色分け切替のたびに再取得が走る
    domainMax: probabilityRangeState.probabilityDomainMax,
    colorColumn: colorColumnControl.colorColumn,
  });

  const areaFilter = parameters.find((p) => p.key === "area");
  const setMapCenterEffect = useSetMapCenterEffect({
    resultViewId: view.id,
    mapInstance: mapInitState.mapInstance,
    getGeometryParams: {
      unit,
      dataSetResultId,
      selectedDate: referenceDateDropdown.selectedDate,
      areas: areaFilter?.value,
    },
    clearPopup: usePopupEffectWithFeatureState.clearPopup,
    unit,
  });

  /** マップに表示される指標。色分けの基準を切り替えるとスライダーの軸も入れ替わる */
  const meta = useMemo(
    () => ({
      label: translateColumnToJapanese(activeColorProperty, unit),
      description: (
        lang.columns[unit] as Record<string, { description?: string }>
      )[activeColorProperty]?.description,
    }),
    [activeColorProperty, unit],
  );

  const [withTable, setWithTable] = useState(false);

  const { allCount } = useMapAllCount({
    dataSetResultId: view.dataSetResultId,
    unit,
  });

  return (
    <div className={mergeClasses(styles.root, styles.flexColumn)}>
      <div className={styles.root}>
        <div className={styles.content}>
          <div className={styles.filters}>
            <div className={styles.filter}>
              <div>
                <TextWithTooltip
                  textNode={meta.label}
                  tooltipContent={meta.description}
                />
              </div>
              <div>
                <ProbabilityRangeSlider {...probabilityRangeState} />
              </div>
            </div>
            <div className={styles.filter}>
              <div>
                {translateColumnToJapanese("reference_date", "building")}
              </div>
              <div>
                <ReferenceDateDropdown {...referenceDateDropdown} />
              </div>
            </div>
            {colorColumnControl.isChangeRateSelectable ? (
              <div className={styles.filter}>
                <div>色分けの基準</div>
                <div>
                  <ColorColumnControl {...colorColumnControl} />
                </div>
              </div>
            ) : null}
            <div className={styles.filter}>
              <div>表</div>
              <Switch
                checked={withTable}
                indicator={{
                  className: styles.indicator,
                }}
                onChange={(_, data) => {
                  setWithTable(data.checked);
                }}
              />
            </div>
          </div>
          {viewportLayerEffectState?.isZoomTooLow ? (
            <Field
              className={styles.fieldMessage}
              validationMessage={`ズームインすると${unit === "building" ? "建物" : "地域"}が表示されます`}
              validationState="warning"
            ></Field>
          ) : viewportLayerEffectState?.viewportStats ? (
            <QueryHeaderWrapper>
              <QueryHeader
                allCount={allCount || 0}
                filteredCount={
                  viewportLayerEffectState.viewportStats.filteredCount
                }
              />
              <Field
                className={styles.fieldMessage}
                validationMessage={`ビューポート内: ${viewportLayerEffectState.viewportStats.recordCount}件`}
                validationState="none"
              ></Field>
            </QueryHeaderWrapper>
          ) : (
            <Field
              className={styles.fieldMessage}
              validationMessage={`ビューポートデータ読み込み中...`}
              validationState="none"
            ></Field>
          )}
          <div className={styles.map}>
            <MapCenterButtons isPreview={isPreview} {...setMapCenterEffect} />
            {viewportLayerEffectState?.isZoomTooLow && (
              <ZoomWarningOverlay unit={unit} />
            )}
            <Map
              domainMax={probabilityRangeState.domainMax}
              domainMin={probabilityRangeState.domainMin}
              filterProperty={activeColorProperty}
              mapInitState={mapInitState}
              range={probabilityRangeState.range}
              viewportLayerEffectState={viewportLayerEffectState}
            />
          </div>
        </div>

        <DrawerTable open={withTable} setWithTable={setWithTable}>
          <ResultTable
            mapInitState={mapInitState}
            selectedDate={referenceDateDropdown.selectedDate}
            selectedFeature={usePopupEffectWithFeatureState.selectedFeature}
            setSelectedFeature={
              usePopupEffectWithFeatureState.setSelectedFeature
            }
            view={view}
          />
        </DrawerTable>
      </div>
    </div>
  );
};
