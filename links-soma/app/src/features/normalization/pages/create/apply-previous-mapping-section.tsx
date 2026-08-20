/**
 * 前回のカラム設定を適用するセクション。
 *
 * 各データセットステップで、直近の完了名寄せジョブが「そのデータセットの」カラム
 * マッピングを持つときだけ表示する。押下でそのデータセットの columns をプリフィル
 * する（id/path は現在の選択を保つ＝ファイルは引き継がず、対応づけだけ流用）。
 *
 * QuickSelectSection（他ステップからの流用）とは出所が異なる兄弟。配置は同じスロット
 * （FormDataset の真上）。選定ロジックは pickPreviousMapping（複数候補は最新の complete）。
 */

import { useEffect, useState } from "react";
import { makeStyles, tokens, Text, Card } from "@fluentui/react-components";
import { History20Regular } from "@fluentui/react-icons";
import { useParams } from "react-router-dom";
import { Controller, type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { useFetchJobs } from "../../../job/hooks/use-fetch-jobs";
import {
  type ColumnMap,
  hasNonEmptyColumnMap,
  pickPreviousMapping,
} from "../../util/pick-previous-mapping";
import { formatDate } from "../../../../shared/utils/format-date";
import { lang } from "../../../../shared/config/lang";

const applyLang = lang.components.normalizationApplyPreviousMapping;

const useStyles = makeStyles({
  section: {
    // 縦のみ padding。左右は 0 にして内側カードを下の FormDataset カードと同じ幅に揃える。
    padding: `${tokens.spacingVerticalM} 0`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    cursor: "pointer",
    minWidth: "220px",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  meta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  applied: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
  schemaKey: keyof FormNormalizationType["data"];
};

export const ApplyPreviousMappingSection = ({
  form,
  schemaKey,
}: Props): JSX.Element | null => {
  const styles = useStyles();
  const { id } = useParams<{ id: string }>();
  const [applied, setApplied] = useState(false);

  const fieldPath = `data.${schemaKey}` as const;
  // ファイル選択で columns が初期化される（form-dataset の updateColumns）。
  // その後に適用させたいので、ファイル未選択（path なし）の間は出さない。
  const current = form.watch(fieldPath) as { path?: string } | undefined;

  // ファイルを選び直すと columns は初期化される。適用済み表示も実態に合わせて戻す。
  // 適用押下では path は変わらない（id/path は保つ）ため、この effect は発火しない。
  useEffect(() => {
    setApplied(false);
  }, [current?.path]);

  // 過去の名寄せジョブ（created_at 降順）。編集中ジョブは候補から除く。
  const { data: jobs } = useFetchJobs(undefined, "preprocess");
  const previous = jobs
    ? pickPreviousMapping(jobs, id ? Number(id) : undefined)
    : null;

  // 当該データセットの前回 columns を取り出す。
  const previousColumns = (
    previous?.data as Record<string, { columns?: ColumnMap } | undefined>
  )?.[schemaKey]?.columns;

  // ファイル未選択、または前回が「このデータセット」を設定していなければ出さない。
  if (
    !current?.path ||
    !previous ||
    !previousColumns ||
    !hasNonEmptyColumnMap(previousColumns)
  ) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <History20Regular />
        <Text>{applyLang.sectionTitle}</Text>
      </div>
      <Controller
        control={form.control}
        name={fieldPath}
        render={({ field: { value, onChange } }) => (
          <Card
            className={styles.card}
            onClick={() => {
              onChange({ ...(value ?? {}), columns: { ...previousColumns } });
              setApplied(true);
            }}
          >
            <Text className={styles.label}>{applyLang.applyLabel}</Text>
            <Text className={styles.meta}>
              {applyLang.lastRunPrefix}
              {formatDate(previous.createdAt ?? "", "YYYY/MM/DD")}
            </Text>
            {applied && (
              <Text className={styles.applied}>{applyLang.appliedLabel}</Text>
            )}
          </Card>
        )}
      />
    </div>
  );
};
