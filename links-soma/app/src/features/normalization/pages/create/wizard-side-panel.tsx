/**
 * ウィザードサイドパネルコンポーネント
 * データセットの説明とカラム設定のヒントを表示
 */

import {
  makeStyles,
  tokens,
  Text,
  Divider,
  Caption1,
  Caption1Strong,
  Subtitle2,
} from "@fluentui/react-components";
import { Info20Regular, DocumentText20Regular } from "@fluentui/react-icons";
import { getNormalizationDatasetInfo } from "../../util/extract-dataset-columns-from-schema";
import { lang } from "../../../../shared/config/lang";
import { LanguageMap } from "../../../../shared/config/metadata";
import { type WizardStepConfig } from "./wizard-steps";

const useStyles = makeStyles({
  sidePanel: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalL,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  section: {
    marginBottom: tokens.spacingVerticalXL,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  // Subtitle2にmarginリセットを追加
  sectionTitle: {
    margin: 0,
  },
  // Caption1のデフォルト色と異なるため色のみ指定
  description: {
    color: tokens.colorNeutralForeground2,
    padding: `0 ${tokens.spacingHorizontalS}`,
  },
  requiredBadge: {
    display: "inline-block",
    padding: `0 ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    borderRadius: tokens.borderRadiusSmall,
  },
  optionalBadge: {
    display: "inline-block",
    padding: `0 ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    borderRadius: tokens.borderRadiusSmall,
  },
  columnList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  columnItem: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  // Caption1Strongにレイアウト指定を追加
  columnLabel: {
    marginBottom: tokens.spacingVerticalXS,
  },
  columnDescription: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  emptyMessage: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  divider: {
    margin: `${tokens.spacingVerticalM} 0`,
  },
  tipSection: {
    marginTop: tokens.spacingVerticalL,
  },
  tipItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
  },
  tipIcon: {
    flexShrink: 0,
    color: tokens.colorBrandForeground1,
  },
  tipText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
});

type Props = {
  /** 現在のステップ設定 */
  stepConfig: WizardStepConfig;
};

export const WizardSidePanel = ({ stepConfig }: Props): JSX.Element => {
  const styles = useStyles();

  // データセットのカラム情報を取得
  const datasetInfo = stepConfig.schemaKey
    ? getNormalizationDatasetInfo(stepConfig.schemaKey)
    : undefined;

  const renderColumnHints = (): JSX.Element => {
    if (
      !datasetInfo ||
      !datasetInfo.hasColumns ||
      datasetInfo.columns.length === 0
    ) {
      return (
        <Text className={styles.emptyMessage}>
          このデータセットにはカラム設定がありません
        </Text>
      );
    }

    // building_type_determination の場合、家屋種別の説明も追加
    const additionalHints =
      stepConfig.schemaKey === "building_type_determination"
        ? [
            {
              key: "building_type_values",
              label:
                lang.components.normalizationParameters.building_type_values
                  .label,
              description:
                lang.components.normalizationParameters.building_type_values
                  .description,
              isColumn: false, // カラムではない
            },
          ]
        : [];

    // カラム情報にisColumnフラグを追加
    const columnHints = datasetInfo.columns.map((col) => ({
      ...col,
      isColumn: true,
    }));

    const allHints = [...columnHints, ...additionalHints];

    return (
      <div className={styles.columnList}>
        {allHints.map((hint) => (
          <div key={hint.key} className={styles.columnItem}>
            <Caption1Strong className={styles.columnLabel}>
              {hint.label}
              {hint.isColumn && "カラム"}
            </Caption1Strong>
            {hint.description && (
              <div className={styles.columnDescription}>{hint.description}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 推定対象選定用データ向けのヒント
  const renderBuildingTypeDeterminationTips = (): JSX.Element => (
    <div className={styles.tipSection}>
      <div className={styles.tipItem}>
        <DocumentText20Regular className={styles.tipIcon} />
        <Text className={styles.tipText}>
          登記情報や建物ポリゴンで選択したデータセットを使用することもできます。
        </Text>
      </div>
    </div>
  );

  return (
    <aside className={styles.sidePanel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Info20Regular />
          <Subtitle2 as="h4" className={styles.sectionTitle}>
            {stepConfig.title}について
          </Subtitle2>
        </div>

        {stepConfig.type === "dataset" && (
          <span
            className={
              stepConfig.isRequired
                ? styles.requiredBadge
                : styles.optionalBadge
            }
          >
            {stepConfig.isRequired ? "必須" : "任意"}
          </span>
        )}

        <Caption1 className={styles.description}>
          {stepConfig.description}
        </Caption1>
      </section>

      {stepConfig.type === "settings" && (
        <>
          <Divider className={styles.divider} />

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Subtitle2 as="h4" className={styles.sectionTitle}>
                設定のヒント
              </Subtitle2>
            </div>
            <div className={styles.columnList}>
              <div className={styles.columnItem}>
                <Caption1Strong className={styles.columnLabel}>
                  {LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
                </Caption1Strong>
                <div className={styles.columnDescription}>
                  {
                    lang.components.normalizationParameters
                      .settingsReferenceDate.description
                  }
                </div>
              </div>
              <div className={styles.columnItem}>
                <Caption1Strong className={styles.columnLabel}>
                  {LanguageMap.NORMALIZATION_PARAMETER_LABEL["municipality"]}
                </Caption1Strong>
                <div className={styles.columnDescription}>
                  {
                    lang.components.normalizationParameters.settingsMunicipality
                      .description
                  }
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {stepConfig.type === "dataset" && (
        <>
          <Divider className={styles.divider} />

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Subtitle2 as="h4" className={styles.sectionTitle}>
                カラム設定のヒント
              </Subtitle2>
            </div>
            {renderColumnHints()}
          </section>

          {stepConfig.schemaKey === "building_type_determination" &&
            renderBuildingTypeDeterminationTips()}
        </>
      )}
    </aside>
  );
};
