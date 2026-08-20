/**
 * ウィザードサイドパネル: ステップの説明と、データセットのマニュアルヒント
 * （取得方法・必要なカラム・注意）を常時表示する。
 */

import {
  makeStyles,
  tokens,
  Text,
  Divider,
  Caption1,
  Caption1Strong,
  Subtitle2,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from "@fluentui/react-components";
import { Info20Regular, Warning16Regular } from "@fluentui/react-icons";
import { Fragment } from "react";
import { lang } from "../../../../shared/config/lang";
import { LanguageMap } from "../../../../shared/config/metadata";
import { type NormalizationPurpose } from "../../hooks/use-form-normalization";
import { type WizardStepConfig } from "./wizard-steps";
import { getManualHint, type ManualHint } from "./manual-hints";

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
  sectionTitle: {
    margin: 0,
  },
  description: {
    color: tokens.colorNeutralForeground2,
    padding: `0 ${tokens.spacingHorizontalS}`,
    // 目的別説明文は段落（空行）を含むため改行を保持する。
    whiteSpace: "pre-line",
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
  columnLabel: {
    marginBottom: tokens.spacingVerticalXS,
  },
  columnDescription: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  divider: {
    margin: `${tokens.spacingVerticalM} 0`,
  },
  // Accordion 内のパネル本文はやや余白を詰める
  accordionPanelBody: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  // 箇条書き（取得方法・注意）
  bulletList: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  bulletItem: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  // 必要なカラム1件
  manualColumnItem: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  manualColumnName: {
    marginBottom: tokens.spacingVerticalXS,
  },
  manualColumnDesc: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  manualColumnExample: {
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  // 期待するファイル形式（見出し＋形式バッジ）。アコーディオン外に常時表示する。
  formatSection: {
    marginBottom: tokens.spacingVerticalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  formatBadgeList: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  formatBadge: {
    padding: `0 ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    fontFamily: tokens.fontFamilyMonospace,
  },
  // 形式が複数あるときの「または」区切り
  formatSeparator: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  formatNote: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
  },
  // 注意ブロックの外枠（見出し＋警告ブロック）。アコーディオン外に常時表示する。
  cautionSection: {
    marginTop: tokens.spacingVerticalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  // 注意・サポート外表記の警告ブロック
  cautionBlock: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorStatusWarningBackground1,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorStatusWarningBorder1}`,
  },
  cautionItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalXS,
  },
  cautionIcon: {
    flexShrink: 0,
    marginTop: "2px",
    color: tokens.colorStatusWarningForeground1,
  },
  cautionText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorStatusWarningForeground1,
    lineHeight: tokens.lineHeightBase200,
  },
});

type Props = {
  /** 現在のステップ設定 */
  stepConfig: WizardStepConfig;
  /** 名寄せの目的。基準日ヒントの出し分けに使う */
  purpose: NormalizationPurpose;
};

export const WizardSidePanel = ({
  stepConfig,
  purpose,
}: Props): JSX.Element => {
  const styles = useStyles();

  // マニュアル由来のヒント（取得方法・必要なカラム・注意）を取得
  const manualHint = getManualHint(stepConfig.schemaKey);

  // マニュアル由来の情報を表示する。取得方法・必要なカラムは折りたたみ、
  // 注意（サポート外表記＝エラー予防）は折りたたまず常時表示する。
  const renderManualHints = (hint: ManualHint): JSX.Element => {
    // 初期で開いておくパネル: 取得方法とカラムは常に表示候補
    const defaultOpen: string[] = ["acquisition"];
    if (hint.columns.length > 0) defaultOpen.push("columns");

    return (
      <>
        {/* 期待するファイル形式: アップロード前に判断できるよう、折りたたまず先頭に置く。 */}
        {hint.formats.length > 0 && (
          <div className={styles.formatSection}>
            <Caption1Strong>アップロードするファイル形式</Caption1Strong>
            <div className={styles.formatBadgeList}>
              {hint.formats.map((format, i) => (
                <Fragment key={format}>
                  {i > 0 && (
                    <Text as="span" className={styles.formatSeparator}>
                      または
                    </Text>
                  )}
                  <Text as="span" className={styles.formatBadge}>
                    {format}
                  </Text>
                </Fragment>
              ))}
            </div>
            {hint.formats.length > 1 && (
              <Text as="span" className={styles.formatNote}>
                いずれか1つの形式でアップロードしてください。
              </Text>
            )}
          </div>
        )}

        <Accordion collapsible defaultOpenItems={defaultOpen} multiple>
          {/* 取得方法 */}
          <AccordionItem value="acquisition">
            <AccordionHeader>取得方法</AccordionHeader>
            <AccordionPanel>
              <div className={styles.accordionPanelBody}>
                <ul className={styles.bulletList}>
                  {hint.acquisition.map((line, i) => (
                    <li key={i} className={styles.bulletItem}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </AccordionPanel>
          </AccordionItem>

          {/* 必要なカラム */}
          {hint.columns.length > 0 && (
            <AccordionItem value="columns">
              <AccordionHeader>
                {`必要なカラム (${hint.columns.length})`}
              </AccordionHeader>
              <AccordionPanel>
                <div className={styles.accordionPanelBody}>
                  {hint.columns.map((col) => (
                    <div key={col.name} className={styles.manualColumnItem}>
                      <Caption1Strong className={styles.manualColumnName}>
                        {col.name}
                      </Caption1Strong>
                      <div className={styles.manualColumnDesc}>{col.desc}</div>
                      {col.example && (
                        <div className={styles.manualColumnExample}>
                          例: {col.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionPanel>
            </AccordionItem>
          )}
        </Accordion>

        {/* 注意・サポート外表記: 見落とすとエラーになるため折りたたまず常時表示。 */}
        {hint.cautions && hint.cautions.length > 0 && (
          <div className={styles.cautionSection}>
            <Caption1Strong>注意</Caption1Strong>
            <div className={styles.cautionBlock}>
              {hint.cautions.map((caution, i) => (
                <div key={i} className={styles.cautionItem}>
                  <Warning16Regular className={styles.cautionIcon} />
                  <Text as="span" className={styles.cautionText}>
                    {caution}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

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
                      .settingsReferenceDate.descriptionByPurpose[purpose]
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

          {/* 取得方法・必要なカラムは自己ラベルのアコーディオンなので、包む見出しは置かない。 */}
          <section className={styles.section}>
            {manualHint && renderManualHints(manualHint)}
          </section>
        </>
      )}
    </aside>
  );
};
