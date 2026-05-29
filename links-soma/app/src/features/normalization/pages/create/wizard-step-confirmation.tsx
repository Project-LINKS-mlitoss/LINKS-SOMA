/**
 * ウィザード確認ステップコンポーネント
 * 入力内容の最終確認画面
 */

import {
  makeStyles,
  tokens,
  Body1Strong,
  Caption1,
  Caption1Strong,
  Badge,
  Tooltip,
} from "@fluentui/react-components";
import {
  Checkmark16Regular,
  Dismiss16Regular,
  Warning16Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import { type UseFormReturn } from "react-hook-form";
import { Button } from "../../../../shared/components/ui/button";
import { dataKeyMapping } from "../../config/dataset-configs";
import { useFetchDatasetWithFilePath } from "../../../dataset/hooks/use-fetch-dataset-with-file-path";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { lang } from "../../../../shared/config/lang";
import { LanguageMap } from "../../../../shared/config/metadata";
import { translateColumnToJapanese } from "../../../../shared/column-translation-utils";
import { getStepIndex, WIZARD_STEPS } from "./wizard-steps";

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
  // Caption1Strongのデフォルト色と異なるため色のみ指定
  sectionTitle: {
    color: tokens.colorNeutralForeground3,
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
  itemRow1: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemRow2: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: tokens.spacingHorizontalM,
  },
  itemLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  // Caption1にレイアウト指定を追加するためのスタイル
  itemValue: {
    maxWidth: "300px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // 基準日用1行レイアウト
  itemSingleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statusIcon: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  configured: {
    color: tokens.colorPaletteGreenForeground1,
  },
  notConfigured: {
    color: tokens.colorPaletteRedForeground1,
  },
  skipped: {
    color: tokens.colorNeutralForeground3,
  },
  warningSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorPaletteYellowForeground1,
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
  manuallySkippedSteps: Set<number>;
  onGoToStep: (stepId: number) => void;
};

type DatasetStatus = {
  stepIndex: number;
  title: string;
  isRequired: boolean;
  isConfigured: boolean;
  isSkipped: boolean;
  filePath?: string;
};

export const WizardStepConfirmation = ({
  form,
  manuallySkippedSteps,
  onGoToStep,
}: Props): JSX.Element => {
  const styles = useStyles();
  const formData = form.getValues();

  // 基準日・市区町村名の取得
  const referenceDate = formData.settings.reference_date;
  const municipality = formData.settings.municipality;

  // データセットのステータスを収集
  const datasetStatuses: DatasetStatus[] = WIZARD_STEPS.filter(
    (
      step,
    ): step is typeof step & {
      schemaKey: NonNullable<typeof step.schemaKey>;
    } => step.type === "dataset" && step.schemaKey !== null,
  ).map((step) => {
    const stepIndex = WIZARD_STEPS.indexOf(step);
    const schemaKey = step.schemaKey;
    const dataKey = dataKeyMapping[
      schemaKey
    ] as keyof typeof lang.components.normalizationData;
    const datasetData = formData.data[schemaKey];
    const hasPath = Boolean(datasetData?.path);
    const isSkipped = manuallySkippedSteps.has(stepIndex);

    return {
      stepIndex,
      title: lang.components.normalizationData[dataKey]?.label || step.title,
      isRequired: step.isRequired,
      isConfigured: hasPath,
      isSkipped,
      filePath: datasetData?.path,
    };
  });

  // 未設定の必須項目を抽出
  const hasRequiredNotConfigured = datasetStatuses.some(
    (s) => s.isRequired && !s.isConfigured,
  );

  const renderStatusIcon = (status: DatasetStatus): JSX.Element => {
    if (status.isSkipped) {
      return (
        <span className={`${styles.statusIcon} ${styles.skipped}`}>
          <Dismiss16Regular />
          <Caption1>スキップ</Caption1>
        </span>
      );
    }
    if (status.isConfigured) {
      return (
        <span className={`${styles.statusIcon} ${styles.configured}`}>
          <Checkmark16Regular />
          <Caption1>設定済み</Caption1>
        </span>
      );
    }
    if (status.isRequired) {
      return (
        <span className={`${styles.statusIcon} ${styles.notConfigured}`}>
          <Warning16Regular />
          <Caption1>未設定（必須）</Caption1>
        </span>
      );
    }
    return (
      <span className={`${styles.statusIcon} ${styles.skipped}`}>
        <Dismiss16Regular />
        <Caption1>未設定</Caption1>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* 警告メッセージ（必須項目が未設定の場合のみ表示） */}
      {hasRequiredNotConfigured && (
        <div className={styles.warningSection}>
          <Warning20Regular />
          <Caption1Strong>必須項目が未設定です</Caption1Strong>
        </div>
      )}

      {/* 基準日・市区町村名 */}
      <section className={styles.section}>
        <Caption1Strong className={styles.sectionTitle}>
          基本設定
        </Caption1Strong>
        <div className={styles.itemSingleRow}>
          <div className={styles.itemLabel}>
            <Body1Strong>{`推定したい日付（${translateColumnToJapanese("reference_date", "building")}）`}</Body1Strong>
            <Caption1 className={styles.itemValue}>
              {referenceDate || "未設定"}
            </Caption1>
          </div>
          <Tooltip
            content="このステップから順に再確認します"
            relationship="label"
          >
            <Button
              appearance="transparent"
              onClick={() => onGoToStep(getStepIndex("settings"))}
              size="small"
            >
              編集
            </Button>
          </Tooltip>
        </div>
        <div className={styles.itemSingleRow}>
          <div className={styles.itemLabel}>
            <Body1Strong>
              {LanguageMap.NORMALIZATION_PARAMETER_LABEL["municipality"]}
            </Body1Strong>
            <Caption1 className={styles.itemValue}>
              {municipality || "未設定"}
            </Caption1>
          </div>
          <Tooltip
            content="このステップから順に再確認します"
            relationship="label"
          >
            <Button
              appearance="transparent"
              onClick={() => onGoToStep(getStepIndex("settings"))}
              size="small"
            >
              編集
            </Button>
          </Tooltip>
        </div>
      </section>

      {/* データセット一覧 */}
      <section className={styles.section}>
        <Caption1Strong className={styles.sectionTitle}>
          データセット設定
        </Caption1Strong>
        <div className={styles.itemList}>
          {datasetStatuses.map((status) => (
            <div key={status.stepIndex} className={styles.item}>
              {/* 1行目: タイトル + バッジ + 編集ボタン */}
              <div className={styles.itemRow1}>
                <div className={styles.itemLabel}>
                  <Body1Strong>{status.title}</Body1Strong>
                  {status.isRequired && (
                    <Badge appearance="outline" color="danger" size="small">
                      必須
                    </Badge>
                  )}
                </div>
                <Tooltip
                  content="このステップから順に再確認します"
                  relationship="label"
                >
                  <Button
                    appearance="transparent"
                    onClick={() => onGoToStep(status.stepIndex)}
                    size="small"
                  >
                    編集
                  </Button>
                </Tooltip>
              </div>
              {/* 2行目: ファイル名 + ステータス */}
              <div className={styles.itemRow2}>
                <DatasetFileName filePath={status.filePath} />
                {renderStatusIcon(status)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/**
 * データセットのファイル名を表示するコンポーネント
 * DBからfile_nameを取得して表示
 */
const DatasetFileName = ({
  filePath,
}: {
  filePath: string | undefined;
}): JSX.Element => {
  const { data } = useFetchDatasetWithFilePath({
    type: "raw",
    filePath,
  });

  if (!data?.file_name) {
    return <span />;
  }

  return <Caption1>└ {data.file_name}</Caption1>;
};
