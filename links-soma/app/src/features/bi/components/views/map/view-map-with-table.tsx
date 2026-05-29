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
import { VacancyLevelCheckbox } from "./vacancy-level-checkbox";
import { useVacancyLevelCheckbox } from "./vacancy-level-checkbox/hooks";
import { ReferenceDateDropdown } from "./reference-date-dropdown";
import { useReferenceDateDropdown } from "./reference-date-dropdown/hooks";
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

  const vacancyLevelCheckboxState = useVacancyLevelCheckbox({
    unit,
  });
  const referenceDateDropdown = useReferenceDateDropdown({
    dataSetResultId: view.dataSetResultId,
  });
  const { getFeatureById } = useFeatureFetcher({ unit });

  const usePopupEffectWithFeatureState = usePopupEffectWithFeature({
    mapInstance: mapInitState.mapInstance,
    view,
    getFeatureById,
  });

  const viewportLayerEffectState = useViewportLayerEffect({
    mapInstance: mapInitState.mapInstance,
    selectedDate: referenceDateDropdown.selectedDate,
    view,
    setSelectedFeature: usePopupEffectWithFeatureState.setSelectedFeature,
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

  /** マップに表示される指標 */
  const meta = useMemo(
    () => ({
      label: translateColumnToJapanese("predicted_probability", unit),
      description: lang.columns[unit].predicted_probability.description,
    }),
    [unit],
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
                <VacancyLevelCheckbox {...vacancyLevelCheckboxState} />
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
              mapInitState={mapInitState}
              vacancyLevels={vacancyLevelCheckboxState.vacancyLevels}
              view={view}
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
