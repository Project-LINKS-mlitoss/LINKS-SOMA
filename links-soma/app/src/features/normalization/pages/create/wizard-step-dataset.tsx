/**
 * ウィザードデータセットステップコンポーネント
 * FormDatasetをラップしてウィザード用UIを提供
 */

import {
  makeStyles,
  tokens,
  Checkbox,
  Caption1,
  Body1,
} from "@fluentui/react-components";
import { Controller, type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { FormDataset } from "../../components/form-dataset";
import { dataKeyMapping } from "../../config/dataset-configs";
import { type lang } from "../../../../shared/config/lang";
import { type WizardStepConfig } from "./wizard-steps";
import { QuickSelectSection } from "./quick-select-section";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  skipContainer: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  // Caption1のデフォルト色と異なるため色のみ指定
  skipLabel: {
    color: tokens.colorNeutralForeground2,
  },
  skippedMessage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalM,
  },
  // Body1のデフォルト色と異なるため色のみ指定
  skippedText: {
    color: tokens.colorNeutralForeground3,
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
  stepConfig: WizardStepConfig;
  isSkipped: boolean;
  onToggleSkip: (isSkipped: boolean) => void;
};

// 特殊フォームを持つデータセット
const DATASETS_WITH_FORM = [
  "address_of_lot_number",
  "building_type_determination",
  "building_polygon",
] as const;

export const WizardStepDataset = ({
  form,
  stepConfig,
  isSkipped,
  onToggleSkip,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (!stepConfig.schemaKey) {
    return <div>Invalid step configuration</div>;
  }

  const schemaKey = stepConfig.schemaKey;
  const dataKey = dataKeyMapping[
    schemaKey
  ] as keyof typeof lang.components.normalizationData;
  const fieldPath = `data.${schemaKey}` as const;

  // 大きな表示が必要なデータセット
  const largeAppearanceDatasets = ["resident_registry", "water_status"];
  const appearance = largeAppearanceDatasets.includes(schemaKey)
    ? "large"
    : "default";

  // 特殊フォームを持つかどうか
  const hasForm = (DATASETS_WITH_FORM as readonly string[]).includes(schemaKey);

  // クイック選択を表示するかどうか
  const showQuickSelect = schemaKey === "building_type_determination";

  return (
    <div className={styles.container}>
      {/* 任意項目の場合はスキップオプションを表示 */}
      {!stepConfig.isRequired && (
        <div className={styles.skipContainer}>
          <Checkbox
            checked={isSkipped}
            label="このステップをスキップする"
            onChange={(_, data) => {
              onToggleSkip(data.checked === true);
            }}
          />
          <Caption1 className={styles.skipLabel}>
            （任意のデータセットなので、入力せずに進むことができます）
          </Caption1>
        </div>
      )}

      {/* スキップされている場合はメッセージを表示 */}
      {isSkipped ? (
        <div className={styles.skippedMessage}>
          <Body1 className={styles.skippedText}>
            このステップはスキップされています
          </Body1>
          <Body1 className={styles.skippedText}>
            上のチェックを外すと入力できます
          </Body1>
        </div>
      ) : (
        <>
          {/* クイック選択セクション（推定対象選定用データ向け） */}
          {showQuickSelect && <QuickSelectSection form={form} />}

          {/* NOTE: Controllerを使用して動的フィールドパスの型推論問題を回避 */}
          {/* form.setValue()直接使用時は型エラーが発生するため、この方式を採用 */}
          <Controller
            key={`form-${schemaKey}`}
            control={form.control}
            name={fieldPath}
            render={({ field: { value, onChange } }) => (
              <FormDataset
                appearance={appearance}
                dataKey={dataKey}
                form={hasForm ? form : undefined}
                onChange={onChange}
                schemaKey={schemaKey}
                value={value}
              />
            )}
          />
        </>
      )}
    </div>
  );
};
