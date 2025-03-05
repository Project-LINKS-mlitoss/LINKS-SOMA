import { forwardRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import { type SelectDataSetDetailBuilding } from "../../../../schema";
import { formatDate } from "../../../../utils/format-date";
import styles from "./building-popup.module.css";
import { PREDICTED_PROBABILITY } from ".";

export type BuildingProperties = Pick<
  SelectDataSetDetailBuilding,
  | "geometry"
  | "predicted_probability"
  | "normalized_address"
  | "household_size"
  | "members_under_15"
  | "members_15_to_64"
  | "members_over_65"
  | "total_water_usage"
  | "water_disconnection_flag"
  | "registration_date"
  | "structure_name"
>;

interface Props {
  properties: BuildingProperties;
}

export const BuildingPopup = forwardRef<HTMLDivElement, Props>(
  ({ properties }, ref) => {
    const { predicted_probability } = properties;
    const predictedProbabilityColorStyle = (() => {
      if (predicted_probability === null) return;
      if (predicted_probability >= PREDICTED_PROBABILITY["building"].high) {
        return styles.high;
      } else if (
        predicted_probability >= PREDICTED_PROBABILITY["building"].medium
      ) {
        return styles.medium;
      } else {
        return styles.low;
      }
    })();

    return (
      <div ref={ref} className={styles.container} tabIndex={-1}>
        <div
          className={mergeClasses(
            styles.header,
            predictedProbabilityColorStyle,
          )}
        >
          <span className={styles.circleIcon} />
          <div>
            <span className={styles.predictedProbability}>
              {properties.predicted_probability !== null
                ? Math.floor(properties.predicted_probability * 1000) / 10
                : "??"}
              %
            </span>
            <div className={styles.address}>
              {properties.normalized_address}
            </div>
          </div>
        </div>
        <div className={styles.info}>
          <div>
            <h3 className={styles.heading}>
              <span
                className={mergeClasses(styles.square, styles.householdIcon)}
              />
              世帯情報
            </h3>
            <div className={styles.item}>
              <span className={styles.itemLabel}>世帯人数</span>
              <span className={styles.itemValue}>
                {properties.household_size}人
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>〜14歳</span>
              <span className={styles.itemValue}>
                {properties.members_under_15}人
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>15-64歳</span>
              <span className={styles.itemValue}>
                {properties.members_15_to_64}人
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>65歳〜</span>
              <span className={styles.itemValue}>
                {properties.members_over_65}人
              </span>
            </div>
          </div>
          <div>
            <h3 className={styles.heading}>
              <span className={mergeClasses(styles.square, styles.waterIcon)} />
              水道情報
            </h3>
            <div className={styles.item}>
              <span className={styles.itemLabel}>水道使用量</span>
              <span className={styles.itemValue}>
                {properties.total_water_usage}L
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>水道使用状況</span>
              <span className={styles.itemValue}>
                {properties.water_disconnection_flag === 0 ? "開" : "閉"}
              </span>
            </div>
          </div>
          <div>
            <h3 className={styles.heading}>
              <span
                className={mergeClasses(styles.square, styles.buildingIcon)}
              />
              建物情報
            </h3>
            <div className={styles.item}>
              <span className={styles.itemLabel}>築年月</span>
              <span className={styles.itemValue}>
                {formatDate(properties.registration_date || "", "YYYY/MM/DD")}
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>構造名称</span>
              <span className={styles.itemValue}>
                {properties.structure_name}
              </span>
            </div>
          </div>
          <div>
            <h3 className={styles.heading}>
              <span className={mergeClasses(styles.square, styles.otherIcon)} />
              その他
            </h3>
            <div className={styles.item}>
              <span>災害避難経路等の情報表示</span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

BuildingPopup.displayName = "BuildingPopup";
