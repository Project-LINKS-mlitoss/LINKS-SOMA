/**
 * ウィザードイントロステップコンポーネント
 * 名寄せ処理に必要なデータの一覧を表示するガイダンスページ
 */

import {
  makeStyles,
  tokens,
  Body1,
  Body1Strong,
  Caption1,
  Caption1Strong,
  Link,
} from "@fluentui/react-components";
import { lang } from "../../../../shared/config/lang";
import { ROUTES, withHash } from "../../../../shared/config/routes";
import { WIZARD_STEPS } from "./wizard-steps";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  item: {
    display: "flex",
    flexDirection: "column",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingVerticalXS,
  },
});

// lang.ts へのショートカット
const introLang = lang.components.normalizationParameters.wizardIntro;

// データセット情報の型
type DatasetInfo = {
  title: string;
  description: string;
  isRequired: boolean;
};

// データセットステップから表示用情報を取得
const getDatasetInfoList = (): {
  required: DatasetInfo[];
  optional: DatasetInfo[];
} => {
  const datasetSteps = WIZARD_STEPS.filter((step) => step.type === "dataset");

  const required: DatasetInfo[] = [];
  const optional: DatasetInfo[] = [];

  for (const step of datasetSteps) {
    const info: DatasetInfo = {
      title: step.title,
      description: step.description,
      isRequired: step.isRequired,
    };

    if (step.isRequired) {
      required.push(info);
    } else {
      optional.push(info);
    }
  }

  return { required, optional };
};

export const WizardStepIntro = (): JSX.Element => {
  const styles = useStyles();
  const { required, optional } = getDatasetInfoList();

  return (
    <div className={styles.container}>
      <Body1>
        {introLang.introText}
        <Link href={withHash(ROUTES.DATASET({ queryParams: { tab: "raw" } }))}>
          {introLang.datasetManagementLink}
        </Link>
        {introLang.datasetManagementSuffix}
      </Body1>

      {/* 必須データセクション */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Caption1Strong>{introLang.requiredSection}</Caption1Strong>
          <Caption1>（{required.length}件）</Caption1>
        </div>
        <div className={styles.itemList}>
          {required.map((dataset) => (
            <div key={dataset.title} className={styles.item}>
              <Body1Strong>{dataset.title}</Body1Strong>
              <Caption1>{dataset.description}</Caption1>
            </div>
          ))}
        </div>
      </section>

      {/* 任意データセクション */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Caption1Strong>{introLang.optionalSection}</Caption1Strong>
          <Caption1>（{optional.length}件）</Caption1>
        </div>
        <div className={styles.itemList}>
          {optional.map((dataset) => (
            <div key={dataset.title} className={styles.item}>
              <Body1Strong>{dataset.title}</Body1Strong>
              <Caption1>{dataset.description}</Caption1>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
