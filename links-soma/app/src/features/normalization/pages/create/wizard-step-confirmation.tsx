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
import {
  getUnassignedColumns,
  type FormNormalizationType,
} from "../../hooks/use-form-normalization";
import { lang } from "../../../../shared/config/lang";
import { LanguageMap } from "../../../../shared/config/metadata";
import { normalizationPurposeLabel } from "../../../../shared/config/normalization-purpose-label";
import { getStepIndex, buildWizardSteps } from "./wizard-steps";

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
  // 必須未設定で「開始する」押下後、カード境界を赤にして問題箇所を可視化。
  // 赤枠ボックスの標準トークン colorPaletteRedBorder1 を使う（join-check 結果と同系統）。
  errorBorder: {
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
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
  /** 「開始する」押下で必須未充足ブロックしたか。検証表示はこの時のみ出す（押下時フィードバック）。 */
  submitAttempted: boolean;
};

type DatasetStatus = {
  stepIndex: number;
  title: string;
  isRequired: boolean;
  isConfigured: boolean;
  isSkipped: boolean;
  filePath?: string;
  /** 割り当てが済んでいないカラム名（画面ラベルではなくスキーマキー）。 */
  unassignedColumns: string[];
};

export const WizardStepConfirmation = ({
  form,
  manuallySkippedSteps,
  onGoToStep,
  submitAttempted,
}: Props): JSX.Element => {
  const styles = useStyles();
  const formData = form.getValues();

  // 目的で解決・並べ替えたステップ列（navigation と同じ並び）。
  const steps = buildWizardSteps(formData.settings.purpose);

  // 基準日・市区町村名の取得
  const referenceDate = formData.settings.reference_date;
  const municipality = formData.settings.municipality;

  // データセットのステータスを収集
  const datasetStatuses: DatasetStatus[] = steps
    .filter(
      (
        step,
      ): step is typeof step & {
        schemaKey: NonNullable<typeof step.schemaKey>;
      } => step.type === "dataset" && step.schemaKey !== null,
    )
    .map((step) => {
      const stepIndex = steps.indexOf(step);
      const schemaKey = step.schemaKey;
      const dataKey = dataKeyMapping[
        schemaKey
      ] as keyof typeof lang.components.normalizationData;
      const datasetData = formData.data[schemaKey];
      const hasPath = Boolean(datasetData?.path);
      const isSkipped = manuallySkippedSteps.has(stepIndex);
      // 実行ゲート（formSchema）と同じ判定を使う。path だけを見ると、カラム未割当で
      // ゲートが弾いた状態を「設定済み」と表示してしまい、押しても無反応になる。
      const unassignedColumns = getUnassignedColumns(schemaKey, formData.data);

      return {
        stepIndex,
        title: lang.components.normalizationData[dataKey]?.label || step.title,
        isRequired: step.isRequired,
        isConfigured: hasPath && unassignedColumns.length === 0,
        isSkipped,
        filePath: datasetData?.path,
        unassignedColumns,
      };
    });

  // 実行がブロックされる条件を、実行ゲート（form.trigger）と一致させて可視化する。
  // 一致していないと、押しても無反応で理由も出ない無言ブロックになる。
  // 内訳は3つ: 必須データセットの未選択 / 選択済みデータセットのカラム未割当（任意も含む・
  // ゲートが弾くため）/ 市区町村名の未入力（住所正規化に必須）。
  const isMunicipalityMissing = municipality.trim().length === 0;
  const hasUnassignedColumns = datasetStatuses.some(
    (s) => s.unassignedColumns.length > 0,
  );
  const hasRequiredNotConfigured =
    datasetStatuses.some((s) => s.isRequired && !s.isConfigured) ||
    hasUnassignedColumns ||
    isMunicipalityMissing;

  const renderStatusIcon = (status: DatasetStatus): JSX.Element => {
    // ファイルは選べているがカラムが未割当。必須・任意を問わずゲートが弾くため、
    // 未選択（＝未設定）とは別の文言で「何を直せばよいか」を示す。
    // スキップより先に判定する。スキップは表示上の印で、ファイルを選んだデータセットは
    // スキップしても payload に載り Python が処理する。ここでスキップ表示を優先すると
    // 「全行スキップ・設定済みなのに開始できない」無言ブロックになる。
    if (status.unassignedColumns.length > 0) {
      return (
        <span className={`${styles.statusIcon} ${styles.notConfigured}`}>
          <Warning16Regular />
          <Caption1>カラム未割当</Caption1>
        </span>
      );
    }
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
    // 必須未設定の赤表示は「開始する」押下後のみ（押下時フィードバック）。押下前は中立の未設定。
    if (status.isRequired && submitAttempted) {
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
      {/* 警告メッセージ（「開始する」押下で必須未設定が残っている場合のみ表示）。 */}
      {submitAttempted && hasRequiredNotConfigured && (
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
            <Body1Strong>
              {lang.components.normalizationPurpose.fieldLabel}
            </Body1Strong>
            <Caption1 className={styles.itemValue}>
              {normalizationPurposeLabel(formData.settings.purpose)}
            </Caption1>
          </div>
        </div>
        <div className={styles.itemSingleRow}>
          <div className={styles.itemLabel}>
            <Body1Strong>
              {LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
            </Body1Strong>
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
        <div
          className={`${styles.itemSingleRow} ${
            submitAttempted && isMunicipalityMissing ? styles.errorBorder : ""
          }`}
        >
          <div className={styles.itemLabel}>
            <Body1Strong>
              {LanguageMap.NORMALIZATION_PARAMETER_LABEL["municipality"]}
            </Body1Strong>
            {!isMunicipalityMissing ? (
              <Caption1 className={styles.itemValue}>{municipality}</Caption1>
            ) : submitAttempted ? (
              <span className={`${styles.statusIcon} ${styles.notConfigured}`}>
                <Warning16Regular />
                <Caption1>未設定（必須）</Caption1>
              </span>
            ) : (
              <Caption1 className={styles.itemValue}>未設定</Caption1>
            )}
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
          {datasetStatuses.map((status) => {
            // 未設定（必須）の赤表示と同条件でカード枠線も赤に（押下時のみ）
            const isError =
              submitAttempted &&
              status.isRequired &&
              !status.isConfigured &&
              !status.isSkipped;
            return (
              <div
                key={status.stepIndex}
                className={`${styles.item} ${isError ? styles.errorBorder : ""}`}
              >
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
            );
          })}
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
