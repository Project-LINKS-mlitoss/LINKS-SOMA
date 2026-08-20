import { WarningFilled, InfoRegular } from "@fluentui/react-icons";
import { forwardRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import { type SelectDataSetDetailBuilding } from "../../../../../../../db/schema";
import {
  OVERLAP_NAVIGATION,
  POPUP_ELEMENT_IDS,
  POPUP_BUTTON_TEXT,
} from "../const";
import { type OverlapInfo } from "../../../../../hooks/map";
import {
  getGradientStops,
  getProbabilityColor,
} from "../../../../../util/map/layer-styles";
import { AllColumnsView } from "./all-columns-view";
import { createBuildingInfoSections } from "./building-info-sections";
import styles from "./building-popup.module.css";
import { PopupSlideContainer } from "./popup-slide-container";
import { PopupToggleButton } from "./popup-toggle-button";

/** Popup表示に必要な値 */
export type BuildingProperties = SelectDataSetDetailBuilding;

interface Props {
  properties: BuildingProperties;
  /** 重複レコード情報（重複がある場合に設定） */
  overlapInfo?: OverlapInfo;
  /**
   * 表示中の推定基準日が最古年度か。最古年度は比較対象（前年・最古）が
   * 存在せず変化率が無意味なため、変化行を表示しない。
   */
  isOldestReferenceDate?: boolean;
}

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

/** 推定基準日（YYYY-MM-DD）から年度ラベルを作る。 */
const formatReferenceYear = (referenceDate: string | null): string =>
  referenceDate ? `${referenceDate.slice(0, 4)}年度` : "";

type ChangeDirection = "up" | "down" | "flat";

/**
 * 空き家推定確率の相対変化率（比率）を符号付き％と方向に整形する純粋関数。
 * 算出対象外（複数年度でない・基準年度など）は null を返し、表示側で省略する。
 */
const formatChangeRate = (
  rate: number | null,
): { text: string; direction: ChangeDirection } | null => {
  if (rate === null || rate === undefined || Number.isNaN(rate)) {
    return null;
  }
  const direction: ChangeDirection =
    rate > 0 ? "up" : rate < 0 ? "down" : "flat";
  // 方向は +/− の符号で示す（記号より即座に読める）。上昇は色でのみ強調する。
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";
  const percent = Math.round(Math.abs(rate) * 1000) / 10;
  return { text: `${sign}${percent}%`, direction };
};

/** 変化率を1項目（ラベル＋値）として描画する。算出対象外なら null。 */
const renderChangeItem = (
  label: string,
  rate: number | null,
): JSX.Element | null => {
  const formatted = formatChangeRate(rate);
  if (!formatted) {
    return null;
  }
  const directionClass =
    formatted.direction === "up"
      ? styles.changeUp
      : formatted.direction === "down"
        ? styles.changeDown
        : styles.changeFlat;
  return (
    <span className={styles.changeItem}>
      <span className={styles.changeLabel}>{label}</span>
      <span className={mergeClasses(styles.changeValue, directionClass)}>
        {formatted.text}
      </span>
    </span>
  );
};

export const BuildingPopup = forwardRef<HTMLDivElement, Props>(
  ({ properties, overlapInfo, isOldestReferenceDate }, ref) => {
    const { predicted_probability } = properties;

    // 家屋種別不明の判定
    const isBuildingTypeUnknown =
      properties.buildingtype_determination_not_possible_flag === 1;

    // SSR対応: フックを使用せず純粋関数で計算
    // ヘッダ色は地図の色分け指標によらず常に確率で決める。この色は文字色にも使うため
    // （styles 側で color と背景アルファに流用）、横ばい付近が淡色になる変化率の
    // 発散配色を入れると確率・住所が白背景に埋もれて読めなくなる。確率は全域が
    // 彩度を持つので可読性が保証される。変化率の値は本文の変化行に数値で出る。
    // building は確率 0〜1 全域なので domainMax=1（area と同じ式で 0.45/0.70 になる）
    const headerColor = getProbabilityColor(
      predicted_probability,
      getGradientStops(1),
    );
    const formattedPredictedProbability = formatPredictedProbability(
      predicted_probability,
    );
    const referenceYear = formatReferenceYear(properties.reference_date);
    // 変化率は複数年度の推定結果でのみ非 null。最古年度・単一年度では省略される。
    const previousChangeItem = renderChangeItem(
      "前年比",
      properties.predicted_probability_change_rate_from_previous,
    );
    const oldestChangeItem = renderChangeItem(
      "最古比",
      properties.predicted_probability_change_rate_from_oldest,
    );
    const buttonText = POPUP_BUTTON_TEXT.SHOW_ALL;

    // 簡易表示のレンダリング関数
    const renderSimpleView = (): JSX.Element => {
      const infoSections = createBuildingInfoSections(properties);
      return (
        <div className={styles.info}>
          {infoSections.map((section, index) => (
            <div key={index}>
              <h3 className={styles.heading}>
                <span
                  className={mergeClasses(
                    styles.square,
                    SECTION_ICON_CLASS[section.title],
                  )}
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
          className={styles.header}
          style={{ color: headerColor, backgroundColor: `${headerColor}1f` }}
        >
          <div className={styles.headerMain}>
            <span
              className={styles.circleIcon}
              style={{ backgroundColor: headerColor }}
            />
            <div className={styles.headerBody}>
              <div className={styles.headerTop}>
                <span className={styles.predictedProbability}>
                  {formattedPredictedProbability}
                </span>
                {referenceYear && (
                  <span className={styles.referenceYear}>{referenceYear}</span>
                )}
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
          {!isOldestReferenceDate &&
            (previousChangeItem || oldestChangeItem) && (
              <div className={styles.changeRow}>
                {previousChangeItem}
                {oldestChangeItem}
              </div>
            )}
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

// セクションタイトル → アイコン class（CSS Modules）の対応。
// セクション定義（building-info-sections.ts）は class を持たないため表示側で付与する。
const SECTION_ICON_CLASS: Record<string, string> = {
  世帯情報: styles.householdIcon,
  水道情報: styles.waterIcon,
  登記情報: styles.buildingIcon,
};
