/**
 * 事前バリデーション「データチェック結果」パネル（FR004-007）。
 *
 * ウィザードのデータセットステップで、フォームの下に軽量チェック結果を表示する。
 * 処理前に「何を確認すべきか」を示し、エラーを未然に防ぐ。
 *
 * 実検証（サンプリング・三値・`useFetchPreValidation`）の結果のみを表示する。
 * 表示すべき観点が無い（カラム未マッピング・対象外データセット等）場合は何も出さない。
 *
 * 表示方針（ADR-0028 / spec: docs/spec/pre-validation.md）:
 * - 発見された問題（warn / error）だけを「カラム / 種類 / 内容」の表で出す。ok / pending は出さない。
 * - カラム列は論理項目名（割り当て先の実カラム名でなく）。誤マッピングでも行を区別でき矛盾表示を防ぐ。
 * - 種類は平易な画面ラベル、内容は具体（どの値・どこ）。種類と内容で役割を分け同義反復を避ける。
 * - 色は warn=amber（status-warning）/ error=赤。アイコンと併用し色だけに依存しない。
 * - タイポグラフィ・アイコンは join-check-result-item に揃える（Caption1 系 + `*16Regular`）。
 */

import { useMemo } from "react";
import {
  makeStyles,
  mergeClasses,
  tokens,
  Caption1,
  Caption1Strong,
  Caption2Strong,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@fluentui/react-components";
import {
  CheckmarkCircle16Regular,
  Warning16Regular,
  ErrorCircle16Regular,
  Info16Regular,
} from "@fluentui/react-icons";
import { THEME_COLORS } from "../../../../shared/config/theme-colors";
import { lang } from "../../../../shared/config/lang";
import { useFetchPreValidation } from "../../hooks/use-fetch-pre-validation";
import { type PreValidationItem } from "../../ipc/pre-validate-dataset";
import { type ResolvedReference } from "../../pre-validation";
import { getNormalizationDatasetInfo } from "../../util/extract-dataset-columns-from-schema";

const PRE_VALIDATION_MESSAGES: Record<string, string> =
  lang.components.normalizationPreValidation.messages;
const PRE_VALIDATION_LABELS: Record<string, string> =
  lang.components.normalizationPreValidation.labels;
const PANEL_ERROR = lang.components.normalizationPreValidation.panelError;
const PANEL = lang.components.normalizationPreValidation.panel;

/** {count} を件数で差し込む。 */
const fmt = (template: string, count: number): string =>
  template.replace("{count}", String(count));

/** 観点キー（AspectId / "reference"）を表示名に解決する。未定義はキーをそのまま出す。 */
const resolveAspect = (aspectKey: string): string =>
  PRE_VALIDATION_LABELS[aspectKey] ?? aspectKey;

/**
 * 表示メッセージを解決する。messageKey があれば lang.ts のテンプレートを差し込みで
 * 文章化し、無ければ prose（message）をそのまま使う（観点ごとの段階移行に対応）。
 */
const resolveMessage = (item: PreValidationItem): string => {
  if (item.messageKey && PRE_VALIDATION_MESSAGES[item.messageKey]) {
    const params = item.messageParams ?? {};
    return PRE_VALIDATION_MESSAGES[item.messageKey].replace(
      /\{(\w+)\}/g,
      (_, k: string) => String(params[k] ?? ""),
    );
  }
  return item.message;
};

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalM,
  },
  headerTitle: { color: tokens.colorNeutralForeground3 },
  // 表のフォント。本文セルは一段階小さく（Caption1 相当 fontSizeBase200）、
  // 列ヘッダーは更に小さく太字のラベル（Caption2 相当 fontSizeBase100・bold）。背景帯は使わない。
  tableFont: {
    // Fluent 既定の table-layout:fixed（列等幅）を auto に上書き。カラム・種類は nowrap で
    // 内容幅に収まり、内容列の width:100% が残り幅を全部取る（auto なので他列は潰れない）。
    tableLayout: "auto",
    "& td": {
      fontSize: tokens.fontSizeBase200,
      lineHeight: tokens.lineHeightBase200,
    },
    "& th": {
      fontSize: tokens.fontSizeBase100,
      lineHeight: tokens.lineHeightBase100,
      fontWeight: tokens.fontWeightBold,
    },
  },
  // カラムセル（アイコン＋論理項目名）。font はセルから継承させる。
  colCell: {
    display: "inline-flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
  },
  // カラム・種類は内容幅に収める（折り返さない）。
  nowrap: { whiteSpace: "nowrap" },
  // 内容列は幅の半分を占める（左寄せ）。カラム・種類は内容幅、内容は約50%。
  detailCol: { width: "50%" },
  // パネル実行失敗の控えめな通知。
  errorNotice: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalSNudge,
    color: tokens.colorNeutralForeground3,
  },
  // アイコンだけ色＋形で重大度を示す（文字色には頼らない）。
  icon: { fontSize: tokens.fontSizeBase400 },
  iconWarn: { color: tokens.colorStatusWarningForeground1 },
  iconError: { color: THEME_COLORS.error },
  // サンプル目安の但し書き（表の下に1回）。
  footnote: {
    paddingTop: tokens.spacingVerticalSNudge,
    color: tokens.colorNeutralForeground3,
  },
  // 問題ゼロのときの控えめな1行。
  quietNote: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalSNudge,
  },
  iconQuiet: { color: tokens.colorNeutralForeground4 },
  quietText: { color: tokens.colorNeutralForeground3 },
});

type Severity = PreValidationItem["status"];

const RowIcon = ({ severity }: { severity: Severity }): JSX.Element => {
  const styles = useStyles();
  if (severity === "error")
    return (
      <ErrorCircle16Regular
        className={mergeClasses(styles.icon, styles.iconError)}
      />
    );
  return (
    <Warning16Regular className={mergeClasses(styles.icon, styles.iconWarn)} />
  );
};

/** データチェック結果カード。発見された問題のみを「カラム / 種類 / 内容」の表で出す。 */
const ValidationCard = ({
  items,
}: {
  items: PreValidationItem[];
}): JSX.Element => {
  const styles = useStyles();
  // 表に出すのは発見された問題（warn / error）だけ。ok / pending は出さない。
  const findings = items.filter(
    (i) => i.status === "warn" || i.status === "error",
  );
  const errorCount = findings.filter((i) => i.status === "error").length;
  const warnCount = findings.length - errorCount;
  // 件数は色でなく語（要確認 / エラー / 問題なし）と太字で示す。
  const summaryText =
    errorCount > 0
      ? fmt(PANEL.summaryError, errorCount)
      : warnCount > 0
        ? fmt(PANEL.summaryAttention, warnCount)
        : PANEL.summaryOk;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Caption2Strong className={styles.headerTitle}>
          {PANEL.title}
        </Caption2Strong>
        {findings.length > 0 ? (
          <Caption1Strong>{summaryText}</Caption1Strong>
        ) : (
          <Caption1>{summaryText}</Caption1>
        )}
      </div>

      {findings.length > 0 ? (
        <>
          <Table
            aria-label={PANEL.title}
            className={styles.tableFont}
            size="small"
          >
            <TableHeader>
              <TableRow>
                <TableHeaderCell className={styles.nowrap}>
                  {PANEL.colHeaderColumn}
                </TableHeaderCell>
                <TableHeaderCell className={styles.nowrap}>
                  {PANEL.colHeaderType}
                </TableHeaderCell>
                <TableHeaderCell className={styles.detailCol}>
                  {PANEL.colHeaderDetail}
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((item) => (
                <TableRow key={`${item.code}-${item.column}-${item.aspectKey}`}>
                  <TableCell className={styles.nowrap}>
                    <span className={styles.colCell}>
                      <RowIcon severity={item.status} />
                      {item.column}
                    </span>
                  </TableCell>
                  <TableCell className={styles.nowrap}>
                    {resolveAspect(item.aspectKey)}
                  </TableCell>
                  <TableCell className={styles.detailCol}>
                    {resolveMessage(item)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Caption1 className={styles.footnote}>{PANEL.sampleNote}</Caption1>
        </>
      ) : (
        <div className={styles.quietNote}>
          <CheckmarkCircle16Regular
            className={mergeClasses(styles.icon, styles.iconQuiet)}
          />
          <Caption1 className={styles.quietText}>{PANEL.noFindings}</Caption1>
        </div>
      )}
    </div>
  );
};

/** パネル実行失敗時の控えめな通知（無言で消さない・非ブロッキング）。 */
const ValidationError = (): JSX.Element => {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      <div className={styles.errorNotice}>
        <Info16Regular
          className={mergeClasses(styles.icon, styles.iconQuiet)}
        />
        <Caption1>{PANEL_ERROR}</Caption1>
      </div>
    </div>
  );
};

type Props = {
  /** データセットステップの schemaKey */
  schemaKey: string | null | undefined;
  /** データセットのファイル名（未選択なら undefined）。 */
  filename?: string;
  /** 論理カラムキー → 実カラム名（フォームのマッピング）。 */
  columns?: Record<string, string>;
  /** クロスファイル参照（親ファイル・実カラムに解決済み・PV-08）。 */
  references?: ResolvedReference[];
};

export const WizardStepValidation = ({
  schemaKey,
  filename,
  columns,
  references,
}: Props): JSX.Element | null => {
  // 行 identity を論理項目名（水道閉栓年月 等）で出すための 論理キー→ラベル。
  // 同じ実カラムを複数項目に割り当てても行を区別でき、「水道番号が日付？」の矛盾を防ぐ。
  const columnLabels = useMemo(() => {
    const info = schemaKey ? getNormalizationDatasetInfo(schemaKey) : undefined;
    return Object.fromEntries(
      (info?.columns ?? []).map((c) => [c.key, c.label]),
    );
  }, [schemaKey]);

  const { data: items, error } = useFetchPreValidation({
    filename,
    schemaKey: schemaKey ?? undefined,
    columns,
    columnLabels,
    references,
  });

  // 実行失敗は控えめに通知する（無言で消さない）。
  if (error) return <ValidationError />;
  if (!items || items.length === 0) return null;
  return <ValidationCard items={items} />;
};
