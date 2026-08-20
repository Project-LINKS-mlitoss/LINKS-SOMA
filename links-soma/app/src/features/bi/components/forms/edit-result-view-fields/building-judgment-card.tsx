/**
 * 建物判定カード（presentational・FR022 モック）。
 *
 * 1 建物について、地図ポップアップ簡易表示と同じ項目（世帯/水道/登記）を表示し、
 * 「空き家として扱う / 空き家として扱わない」を選ばせる。情報セクションの定義は
 * building-popup と共有する createBuildingInfoSections を再利用する。
 */

import {
  makeStyles,
  tokens,
  RadioGroup,
  Radio,
  Text,
} from "@fluentui/react-components";
import { type SelectDataSetDetailBuilding } from "../../../../../db/schema";
import { lang } from "../../../../../shared/config/lang";
import { createBuildingInfoSections } from "../../views/map/map-container/_components/building-info-sections";

const t = lang.components["threshold-assistant"];

type Judgment = "vacant" | "not";

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // 住所をカードの識別子（見出し）にする。モデルの推定確率はあえて出さない
  // （アンカリング回避: ユーザーの独立判断を証拠から引き出すため。確率の文脈は帯見出しに一本化）。
  address: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  sections: {
    display: "flex",
    flexWrap: "wrap",
    columnGap: tokens.spacingHorizontalXL,
    rowGap: tokens.spacingVerticalM,
  },
  section: {
    minWidth: "140px",
    flex: "1 1 140px",
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXXS,
    display: "block",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  itemLabel: {
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  itemValue: {
    color: tokens.colorNeutralForeground1,
    overflowWrap: "anywhere",
  },
  itemEmpty: {
    color: tokens.colorNeutralForeground4,
  },
});

export const BuildingJudgmentCard = ({
  building,
  value,
  onChange,
}: {
  building: SelectDataSetDetailBuilding;
  value: Judgment | undefined;
  onChange: (v: Judgment) => void;
}): JSX.Element => {
  const styles = useStyles();
  const sections = createBuildingInfoSections(building);

  return (
    <div className={styles.card}>
      <Text className={styles.address}>{building.normalized_address}</Text>

      <div className={styles.sections}>
        {sections.map((section, index) => (
          <div key={index} className={styles.section}>
            <Text className={styles.sectionTitle} size={200}>
              {section.title}
            </Text>
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className={styles.item}>
                <Text className={styles.itemLabel} size={200}>
                  {item.label}
                </Text>
                <Text className={styles.itemValue} size={200}>
                  {item.value !== null && item.value !== undefined ? (
                    `${item.value}${item.suffix ?? ""}`
                  ) : (
                    <span className={styles.itemEmpty}>--</span>
                  )}
                </Text>
              </div>
            ))}
          </div>
        ))}
      </div>

      <RadioGroup
        layout="horizontal"
        onChange={(_, data) => onChange(data.value as Judgment)}
        value={value ?? ""}
      >
        <Radio label={t.feedbackVacant} value="vacant" />
        <Radio label={t.feedbackNot} value="not" />
      </RadioGroup>
    </div>
  );
};
