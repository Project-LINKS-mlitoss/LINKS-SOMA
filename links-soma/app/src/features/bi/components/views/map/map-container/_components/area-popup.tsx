import { forwardRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import { type SelectDataSetDetailArea } from "../../../../../../../db/schema";
import { PREDICTED_PROBABILITY, POPUP_BUTTON_TEXT } from "../const";
import { PopupToggleButton } from "./popup-toggle-button";
import { PopupSlideContainer } from "./popup-slide-container";
import { AllColumnsView } from "./all-columns-view";
import styles from "./area-popup.module.css";

export type AreaProperties = SelectDataSetDetailArea;

interface Props {
  properties: AreaProperties;
}

/**
 * 空き家推定確率に基づく色スタイルを計算（SSR対応のため純粋関数）
 */
const getPredictedProbabilityColorStyle = (
  predictedProbability: number | null,
): string | undefined => {
  if (predictedProbability === null) return undefined;
  if (predictedProbability >= PREDICTED_PROBABILITY.area.high) {
    return "high";
  } else if (predictedProbability >= PREDICTED_PROBABILITY.area.medium) {
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

export const AreaPopup = forwardRef<HTMLDivElement, Props>(
  ({ properties }, ref) => {
    const { predicted_probability } = properties;

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
            <span className={styles.predictedProbability}>
              {formattedPredictedProbability}
            </span>
            <div className={styles.address}>{properties.area_group}</div>
          </div>
        </div>

        <PopupSlideContainer
          allColumnsView={
            <AllColumnsView
              className={styles.allColumnsContainer}
              properties={properties}
              type="area"
            />
          }
          simpleView={renderSimpleView()}
        />
        <PopupToggleButton buttonText={buttonText} />
      </div>
    );
  },
);

AreaPopup.displayName = "AreaPopup";

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
const createInfoSections = (properties: AreaProperties): InfoSection[] => [
  {
    title: "世帯情報",
    iconClass: styles.householdIcon,
    items: [
      {
        label: "若年層率",
        value:
          properties.young_population_ratio !== null
            ? Math.floor(properties.young_population_ratio * 1000) / 10
            : "--",
        suffix: "%",
      },
      {
        label: "高年者率",
        value:
          properties.elderly_population_ratio !== null
            ? Math.floor(properties.elderly_population_ratio * 1000) / 10
            : "--",
        suffix: "%",
      },
    ],
  },
  {
    title: "地域情報",
    iconClass: styles.landIcon,
    items: [
      {
        label: "面積",
        value:
          properties.area !== null
            ? Math.round(properties.area * 10) / 10
            : "--",
        suffix: "m2",
      },
      {
        label: "空き家件数",
        value: properties.vacant_house_count,
        suffix: "件",
      },
      {
        label: "地域内の家屋件数",
        value: properties.total_building_count,
        suffix: "件",
      },
    ],
  },
];
