import { WarningFilled, InfoRegular } from "@fluentui/react-icons";
import { forwardRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import { type SelectDataSetDetailBuilding } from "../../../../../../../db/schema";
import {
  OVERLAP_NAVIGATION,
  POPUP_ELEMENT_IDS,
  PREDICTED_PROBABILITY,
  POPUP_BUTTON_TEXT,
} from "../const";
import { type OverlapInfo } from "../../../../../hooks/map";
import { AllColumnsView } from "./all-columns-view";
import styles from "./building-popup.module.css";
import { PopupSlideContainer } from "./popup-slide-container";
import { PopupToggleButton } from "./popup-toggle-button";

/** Popup表示に必要な値 */
export type BuildingProperties = SelectDataSetDetailBuilding;

interface Props {
  properties: BuildingProperties;
  /** 重複レコード情報（重複がある場合に設定） */
  overlapInfo?: OverlapInfo;
}

/**
 * 空き家推定確率に基づく色スタイルを計算（SSR対応のため純粋関数）
 */
const getPredictedProbabilityColorStyle = (
  predictedProbability: number | null,
): string | undefined => {
  if (predictedProbability === null) return undefined;
  if (predictedProbability >= PREDICTED_PROBABILITY.building.high) {
    return "high";
  } else if (predictedProbability >= PREDICTED_PROBABILITY.building.medium) {
    return "medium";
  }
  return "low";
};

/**
 * 空き家推定確率をフォーマット（SSR対応のため純粋関数）
 */
const formatPredictedProbability = (
  predictedProbability: number | null,
): string => {
  return predictedProbability !== null
    ? `${Math.floor(predictedProbability * 1000) / 10}%`
    : "??%";
};

export const BuildingPopup = forwardRef<HTMLDivElement, Props>(
  ({ properties, overlapInfo }, ref) => {
    const { predicted_probability } = properties;

    // 家屋種別不明の判定
    const isBuildingTypeUnknown =
      properties.buildingtype_determination_not_possible_flag === 1;

    // SSR対応: フックを使用せず純粋関数で計算
    const predictedProbabilityColorStyle = getPredictedProbabilityColorStyle(
      predicted_probability,
    );
    const formattedPredictedProbability = formatPredictedProbability(
      predicted_probability,
    );
    const buttonText = POPUP_BUTTON_TEXT.SHOW_ALL;

    // 簡易表示のレンダリング関数
    const renderSimpleView = (): JSX.Element => {
      const infoSections = createInfoSections(properties);
      return (
        <div className={styles.info}>
          {infoSections.map((section, index) => (
            <div key={index}>
              <h3 className={styles.heading}>
                <span
                  className={mergeClasses(styles.square, section.iconClass)}
                />
                {section.title}
              </h3>
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className={styles.item}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemValue}>
                    {item.value !== null && item.value !== undefined ? (
                      `${item.value}${item.suffix || ""}`
                    ) : (
                      <span style={{ color: "#999" }}>--</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div ref={ref} className={styles.container} tabIndex={-1}>
        <div
          className={mergeClasses(
            styles.header,
            predictedProbabilityColorStyle
              ? styles[predictedProbabilityColorStyle]
              : undefined,
          )}
        >
          <span className={styles.circleIcon} />
          <div>
            <div>
              <span className={styles.predictedProbability}>
                {formattedPredictedProbability}
              </span>
            </div>
            {isBuildingTypeUnknown && (
              <div className={styles.buildingTypeUnknown}>
                <WarningFilled />
                <span>家屋種別不明</span>
              </div>
            )}
            <div className={styles.address}>
              {properties.normalized_address}
            </div>
          </div>
        </div>
        {overlapInfo?.hasOverlap && (
          <>
            <div className={styles.overlapBanner}>
              <WarningFilled className={styles.overlapIcon} />
              <span className={styles.overlapText}>
                {overlapInfo.totalCount}件の重複
              </span>
              <span
                className={styles.overlapTooltip}
                data-tooltip="同一の建物に複数のレコードが存在します"
              >
                <InfoRegular className={styles.overlapInfoIcon} />
              </span>
              <div className={styles.overlapNavigation}>
                <button
                  className={styles.overlapNavButton}
                  disabled={overlapInfo.currentIndex === 0}
                  id={POPUP_ELEMENT_IDS.OVERLAP_NAV_PREV}
                  type="button"
                >
                  &lt;
                </button>
                <span
                  className={styles.overlapNavIndicator}
                  id={POPUP_ELEMENT_IDS.OVERLAP_NAV_INDICATOR}
                >
                  {overlapInfo.currentIndex + 1} /{" "}
                  {Math.min(
                    overlapInfo.totalCount,
                    OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS,
                  )}
                </span>
                <button
                  className={styles.overlapNavButton}
                  disabled={
                    overlapInfo.currentIndex >=
                    Math.min(
                      overlapInfo.totalCount,
                      OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS,
                    ) -
                      1
                  }
                  id={POPUP_ELEMENT_IDS.OVERLAP_NAV_NEXT}
                  type="button"
                >
                  &gt;
                </button>
              </div>
            </div>
            {overlapInfo.totalCount >
              OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS && (
              <div className={styles.overlapLimitWarning}>
                <InfoRegular />
                <span>
                  表示上限{OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS}
                  件（全{overlapInfo.totalCount}件）
                </span>
              </div>
            )}
          </>
        )}
        <PopupSlideContainer
          allColumnsView={
            <AllColumnsView
              className={styles.allColumnsContainer}
              properties={properties}
              type="building"
            />
          }
          simpleView={renderSimpleView()}
        />
        <PopupToggleButton buttonText={buttonText} />
      </div>
    );
  },
);

BuildingPopup.displayName = "BuildingPopup";

// 情報セクションの型定義
interface InfoSection {
  title: string;
  iconClass: string;
  items: Array<{
    label: string;
    value: string | number | null;
    suffix?: string;
  }>;
}

// セクションデータの定義
const createInfoSections = (properties: BuildingProperties): InfoSection[] => [
  {
    title: "世帯情報",
    iconClass: styles.householdIcon,
    items: [
      {
        label: "世帯人数",
        value: properties.household_size,
        suffix: "人",
      },
      {
        label: "〜14歳",
        value: properties.members_under_15,
        suffix: "人",
      },
      {
        label: "65歳〜",
        value: properties.members_over_65,
        suffix: "人",
      },
    ],
  },
  {
    title: "水道情報",
    iconClass: styles.waterIcon,
    items: [
      {
        label: "水道使用量",
        value: properties.total_water_usage,
        suffix: "立米",
      },
      {
        label: "水道使用状況",
        value: properties.water_disconnection_flag === 0 ? "開" : "閉",
      },
    ],
  },
  {
    title: "登記情報",
    iconClass: styles.buildingIcon,
    items: [
      {
        label: "家屋種別",
        value: properties.building_type,
      },
      { label: "構造名称", value: properties.structure_name },
      {
        label: "相続の有無",
        value:
          properties.days_since_registration_event &&
          properties.days_since_registration_event > 0
            ? "有"
            : "無",
      },
    ],
  },
];
