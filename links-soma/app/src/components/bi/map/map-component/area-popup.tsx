import { forwardRef } from "react";
import { mergeClasses } from "@fluentui/react-components";
import { type SelectDataSetDetailArea } from "../../../../schema";
import styles from "./area-popup.module.css";
import { PREDICTED_PROBABILITY } from ".";

export type AreaProperties = Pick<
  SelectDataSetDetailArea,
  | "geometry"
  | "predicted_probability"
  | "young_population_ratio"
  | "elderly_population_ratio"
  | "area_group"
  | "area"
  | "vacant_house_count"
>;

interface Props {
  properties: AreaProperties;
}

export const AreaPopup = forwardRef<HTMLDivElement, Props>(
  ({ properties }, ref) => {
    const { predicted_probability } = properties;
    const predictedProbabilityColorStyle = (() => {
      if (predicted_probability === null) return;
      if (predicted_probability >= PREDICTED_PROBABILITY["area"].high) {
        return styles.high;
      } else if (
        predicted_probability >= PREDICTED_PROBABILITY["area"].medium
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
            <div className={styles.address}>{properties.area_group}</div>
          </div>
        </div>
        <div className={styles.info}>
          <div>
            <h3 className={styles.heading}>
              <span className={`${styles.square} ${styles.householdIcon}`} />
              世帯情報
            </h3>
            <div className={styles.item}>
              <span className={styles.itemLabel}>若年層率</span>
              <span className={styles.itemValue}>
                {properties.young_population_ratio !== null
                  ? Math.floor(properties.young_population_ratio * 1000) / 10
                  : "??"}
                %
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>高年者率</span>
              <span className={styles.itemValue}>
                {properties.elderly_population_ratio !== null
                  ? Math.floor(properties.elderly_population_ratio * 1000) / 10
                  : "??"}
                %
              </span>
            </div>
          </div>
          <div>
            <h3 className={styles.heading}>
              <span className={`${styles.square} ${styles.landIcon}`} />
              土地情報
            </h3>
            <div className={styles.item}>
              <span className={styles.itemLabel}>面積</span>
              <span className={styles.itemValue}>
                {properties.area !== null
                  ? Math.floor(properties.area * 1000) / 10
                  : "??"}
                m2
              </span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemLabel}>空き家件数</span>
              <span className={styles.itemValue}>
                {properties.vacant_house_count}件
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

AreaPopup.displayName = "AreaPopup";
