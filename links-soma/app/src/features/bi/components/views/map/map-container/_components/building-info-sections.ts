import { type SelectDataSetDetailBuilding } from "../../../../../../../db/schema";

/**
 * ポップアップ簡易表示・建物判定カードで共有する情報セクション定義。
 *
 * アイコンの class 名は表示側（building-popup の CSS Modules / 判定カードの makeStyles）で
 * 付与するため、ここではラベル・値・suffix のみを返す。
 */
export interface InfoSection {
  title: string;
  items: Array<{
    label: string;
    value: string | number | null;
    suffix?: string;
  }>;
}

/** 世帯情報・水道情報・登記情報の 3 セクションを生成する。 */
export const createBuildingInfoSections = (
  properties: SelectDataSetDetailBuilding,
): InfoSection[] => [
  {
    title: "世帯情報",
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
    items: [
      {
        label: "家屋種別",
        value: properties.building_type,
      },
      { label: "構造名称", value: properties.structure_name },
      { label: "築年数", value: properties.building_age_years, suffix: "年" },
      {
        label: "相続後経過年数",
        value: properties.years_since_inheritance,
        suffix: "年",
      },
      {
        label: "増築後経過年数",
        value: properties.years_since_extension,
        suffix: "年",
      },
    ],
  },
];
