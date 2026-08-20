/**
 * ウィザードイントロステップ（全幅1カラム。サイドパネルなし）
 *
 * 本ステップの主目的: 名寄せの目的（空き家推定 / AIモデル構築）を選ばせ、
 * 選択に応じて以降のラベル・説明文・必須/任意を出し分ける起点とする。
 *
 * 構成:
 *   1. 目的の選択（横2列の選択カード）— 空き家推定（汎用モデル）/
 *      AIモデル構築（自治体独自モデル）。選択は form.settings.purpose に束ねる。
 *   2. 用意するデータ（一覧）— 選択した目的に応じて必須/任意に分類。
 *
 * 設計上の約束:
 * - 名寄せの概念説明は h2 直下の ProcessIntro に一本化（ここでは説明しない）。
 * - 2択は purpose を選ぶ radiogroup（選択中はブランド枠で強調）。
 * - 語彙は UI SSOT（normalizationPurpose）に準拠。
 * - データ項目・分類・説明は WIZARD_STEPS＋lang を唯一の出典とし、目的で解決する。
 */

import {
  makeStyles,
  mergeClasses,
  tokens,
  Body1,
  Body1Strong,
  Caption1,
  Caption1Strong,
  Subtitle2,
  Link,
} from "@fluentui/react-components";
import { useRef } from "react";
import { type UseFormReturn } from "react-hook-form";
import { lang } from "../../../../shared/config/lang";
import { ROUTES, withHash } from "../../../../shared/config/routes";
import {
  type FormNormalizationType,
  type NormalizationPurpose,
} from "../../hooks/use-form-normalization";
import { WIZARD_STEPS, resolveStepConfig, type DataKeys } from "./wizard-steps";

const introLang = lang.components.normalizationParameters.wizardIntro;

type DatasetInfo = { schemaKey: DataKeys; title: string; description: string };

/**
 * データセットを必須/任意に分類する。必須性・説明文は目的で解決する。
 * 空き家調査結果は空き家推定用では任意、AIモデル構築用では必須。
 */
const getDatasetInfoList = (
  purpose: NormalizationPurpose,
): {
  required: DatasetInfo[];
  optional: DatasetInfo[];
} => {
  const required: DatasetInfo[] = [];
  const optional: DatasetInfo[] = [];
  for (const step of WIZARD_STEPS) {
    if (step.type !== "dataset" || step.schemaKey == null) continue;
    const resolved = resolveStepConfig(step, purpose);
    const info: DatasetInfo = {
      schemaKey: step.schemaKey,
      title: step.title,
      description: resolved.description,
    };
    if (resolved.isRequired) required.push(info);
    else optional.push(info);
  }
  return { required, optional };
};

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXXL,
    maxWidth: "1040px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  lead: {
    color: tokens.colorNeutralForeground2,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
  },

  // ===== 2択の中身 =====
  // 近接の原則: 塊（説明 / 必要なデータ）の間は広め、塊の中は詰める。
  choiceBody: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  // 塊1: 見出し＋説明（中は詰める）。
  choiceHead: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  choiceHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  // 塊2: 必要なデータ（ラベル＋チップ＋注記。中は詰める）。
  needsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  needsLabel: {
    color: tokens.colorNeutralForeground3,
  },
  needsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
  },
  // チップは既存実績のあるグレー（colorNeutralBackground3）。差分は「＋」で示す。
  needsChip: {
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusSmall,
  },
  needsNote: {
    color: tokens.colorNeutralForeground3,
  },

  // ===== 目的の2択（横2列の選択カード） =====
  choiceGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    columnGap: tokens.spacingHorizontalL,
  },
  // 選択可能なカード（radio）。選択中はブランド枠で強調する。
  choiceCell: {
    cursor: "pointer",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  choiceCellSelected: {
    border: `1px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  // ラジオ表示。選択中はブランド色（Fluent の選択状態に準拠）。
  radio: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
    borderRadius: tokens.borderRadiusCircular,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  radioDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandStroke1,
  },

  // ===== 用意するデータ一覧 =====
  uploadHint: {
    color: tokens.colorNeutralForeground3,
  },
  tiers: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  tier: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  tierHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  tierNote: {
    color: tokens.colorNeutralForeground3,
  },
  itemGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  itemDesc: {
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
    // 目的別説明文は段落（空行）を含むため改行を保持する。
    whiteSpace: "pre-line",
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
};

export const WizardStepIntro = ({ form }: Props): JSX.Element => {
  const styles = useStyles();
  const purpose = form.watch("settings.purpose");
  const { required, optional } = getDatasetInfoList(purpose);

  const selectPurpose = (next: NormalizationPurpose): void => {
    form.setValue("settings.purpose", next, { shouldDirty: true });
  };

  // radiogroup の矢印キー移動（roving tabindex で選択中のみフォーカス可能）。
  const cardRefs = useRef<Record<NormalizationPurpose, HTMLDivElement | null>>({
    vacancy_estimation: null,
    model_training: null,
  });
  const moveSelection = (current: NormalizationPurpose, dir: 1 | -1): void => {
    const order: NormalizationPurpose[] = [
      "vacancy_estimation",
      "model_training",
    ];
    const next =
      order[(order.indexOf(current) + dir + order.length) % order.length];
    selectPurpose(next);
    cardRefs.current[next]?.focus();
  };

  // 目的の選択カード（role=radio）。クリック・Enter/Space で選択、矢印キーで移動。
  const renderChoice = (
    value: NormalizationPurpose,
    content: JSX.Element,
  ): JSX.Element => {
    const selected = purpose === value;
    return (
      <div
        key={value}
        ref={(el) => {
          cardRefs.current[value] = el;
        }}
        aria-checked={selected}
        className={mergeClasses(
          styles.choiceCell,
          selected && styles.choiceCellSelected,
        )}
        onClick={() => selectPurpose(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectPurpose(value);
          } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            moveSelection(value, 1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            moveSelection(value, -1);
          }
        }}
        role="radio"
        tabIndex={selected ? 0 : -1}
      >
        {content}
      </div>
    );
  };

  // 選択状態を示すラジオ表示（ブランド色は使わずニュートラルで強調）。
  const renderRadio = (selected: boolean): JSX.Element => (
    <span
      className={mergeClasses(styles.radio, selected && styles.radioSelected)}
    >
      {selected && <span className={styles.radioDot} />}
    </span>
  );

  // 必要データの手がかり（チップ）。AIモデル構築用は空き家調査結果が必須として加わる。
  const renderNeeds = (isCustom: boolean): JSX.Element => (
    <div className={styles.needsBlock}>
      <Caption1Strong className={styles.needsLabel}>
        {introLang.needsLabel}
      </Caption1Strong>
      <div className={styles.needsList}>
        <span className={styles.needsChip}>
          {isCustom
            ? introLang.approachCustomNeeds
            : introLang.approachGenericNeeds}
        </span>
        {isCustom && (
          <span className={styles.needsChip}>
            ＋ {introLang.approachCustomExtra}
          </span>
        )}
      </div>
      <Caption1 className={styles.needsNote}>
        ＋ {introLang.approachOptionalNote}
      </Caption1>
    </div>
  );

  // 2択の中身（空き家推定用＝汎用モデル / AIモデル構築用＝自治体独自モデル）。
  const renderGeneric = (selected: boolean): JSX.Element => (
    <div className={styles.choiceBody}>
      <div className={styles.choiceHead}>
        <div className={styles.choiceHeader}>
          {renderRadio(selected)}
          <Body1Strong>{introLang.approachGenericTitle}</Body1Strong>
        </div>
        <Caption1 className={styles.muted}>
          {introLang.approachGenericBody}
        </Caption1>
      </div>
      {renderNeeds(false)}
    </div>
  );

  const renderCustom = (selected: boolean): JSX.Element => (
    <div className={styles.choiceBody}>
      <div className={styles.choiceHead}>
        <div className={styles.choiceHeader}>
          {renderRadio(selected)}
          <Body1Strong>{introLang.approachCustomTitle}</Body1Strong>
        </div>
        <Caption1 className={styles.muted}>
          {introLang.approachCustomBody}
        </Caption1>
      </div>
      {renderNeeds(true)}
    </div>
  );

  const renderItems = (items: DatasetInfo[]): JSX.Element => (
    <div className={styles.itemGrid}>
      {items.map((d) => (
        <div key={d.schemaKey} className={styles.item}>
          <Body1Strong>{d.title}</Body1Strong>
          <Caption1 className={styles.itemDesc}>{d.description}</Caption1>
        </div>
      ))}
    </div>
  );

  const renderTier = (
    title: string,
    note: string,
    items: DatasetInfo[],
  ): JSX.Element => (
    <div className={styles.tier}>
      <div className={styles.tierHeader}>
        <Caption1Strong>{title}</Caption1Strong>
      </div>
      <Caption1 className={styles.tierNote}>{note}</Caption1>
      {renderItems(items)}
    </div>
  );

  return (
    <div className={styles.container}>
      {/* 名寄せの目的を選ぶ（横2列の選択カード・radiogroup） */}
      <section className={styles.section}>
        <Subtitle2>{introLang.approachTitle}</Subtitle2>
        <Body1 className={styles.lead}>{introLang.approachLead}</Body1>
        <div className={styles.choiceGrid} role="radiogroup">
          {renderChoice(
            "vacancy_estimation",
            renderGeneric(purpose === "vacancy_estimation"),
          )}
          {renderChoice(
            "model_training",
            renderCustom(purpose === "model_training"),
          )}
        </div>
      </section>

      {/* 用意するデータ一覧 */}
      <section className={styles.section}>
        <Subtitle2>{introLang.dataTitle}</Subtitle2>
        <Caption1 className={styles.uploadHint}>
          {introLang.uploadPrefix}
          <Link
            href={withHash(ROUTES.DATASET({ queryParams: { tab: "raw" } }))}
          >
            {introLang.datasetManagementLink}
          </Link>
          {introLang.uploadSuffix}
        </Caption1>

        <div className={styles.tiers}>
          {renderTier(
            introLang.requiredGroupTitle,
            introLang.requiredGroupNote,
            required,
          )}
          {renderTier(
            introLang.optionalGroupTitle,
            introLang.optionalGroupNote,
            optional,
          )}
        </div>
      </section>
    </div>
  );
};
