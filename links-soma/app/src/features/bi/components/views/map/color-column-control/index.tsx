import {
  Dropdown,
  Option,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { translateColumnToJapanese } from "../../../../../../shared/column-translation-utils";
import {
  CHANGE_RATE_BOUND,
  LAYER_COLORS,
} from "../../../../util/map/layer-styles";
import { isChangeRateColumn } from "../../../../util/map/color-column";
import { type ColorColumnControlReturn } from "./hooks";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    minWidth: "240px",
  },
  // 増減の色見本。左端が減少、右端が増加になるよう配色の並びと一致させる
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  bar: {
    height: "8px",
    borderRadius: tokens.borderRadiusSmall,
    background: `linear-gradient(to right, ${LAYER_COLORS.DECREASE}, ${LAYER_COLORS.UNCHANGED}, ${LAYER_COLORS.RED})`,
  },
  scale: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  // 算出対象外はグラデーション外の別色。「変化なし」と読み違えないよう独立して示す
  excluded: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  excludedSwatch: {
    width: "10px",
    height: "10px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: LAYER_COLORS.GRAY,
    flexShrink: 0,
  },
});

const OPTION_LABELS = {
  probability: translateColumnToJapanese("predicted_probability", "building"),
  "change-rate-from-previous": translateColumnToJapanese(
    "predicted_probability_change_rate_from_previous",
    "building",
  ),
  "change-rate-from-oldest": translateColumnToJapanese(
    "predicted_probability_change_rate_from_oldest",
    "building",
  ),
} as const;

const toPercent = (value: number): string => `${Math.round(value * 100)}%`;

/**
 * 地図の色分け指標の切り替え。変化率を選べる場合のみ表示する。
 * 変化率は増減の向きを色相で表すため、確率にはない凡例を添える。
 */
export function ColorColumnControl({
  colorColumn,
  setColorColumn,
  isChangeRateSelectable,
}: ColorColumnControlReturn): JSX.Element | null {
  const styles = useStyles();

  if (!isChangeRateSelectable) return null;

  return (
    <div className={styles.container}>
      <Dropdown
        aria-label="色分けの基準"
        onOptionSelect={(_, data) => {
          if (data.optionValue) {
            setColorColumn(data.optionValue as typeof colorColumn);
          }
        }}
        selectedOptions={[colorColumn]}
        value={OPTION_LABELS[colorColumn]}
      >
        {(Object.keys(OPTION_LABELS) as (keyof typeof OPTION_LABELS)[]).map(
          (column) => (
            <Option key={column} value={column}>
              {OPTION_LABELS[column]}
            </Option>
          ),
        )}
      </Dropdown>
      {isChangeRateColumn(colorColumn) ? (
        <div className={styles.legend}>
          <div className={styles.bar} />
          <div className={styles.scale}>
            <span>{`減少 ${toPercent(-CHANGE_RATE_BOUND)}以下`}</span>
            <span>変化なし</span>
            <span>{`増加 ${toPercent(CHANGE_RATE_BOUND)}以上`}</span>
          </div>
          <div className={styles.excluded}>
            <span className={styles.excludedSwatch} />
            <span>算出対象外（比較できる年度がない）</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
