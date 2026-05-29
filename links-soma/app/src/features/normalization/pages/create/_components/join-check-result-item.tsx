/**
 * 住所の表記ゆれチェック結果項目コンポーネント
 *
 * @description
 * - 個別データセットの結果を表示
 * - 未結合データがある場合は展開してテーブル表示
 * - CSVダウンロード機能を提供
 */

import { useMemo } from "react";
import {
  makeStyles,
  tokens,
  Caption1,
  Caption1Strong,
  Badge,
} from "@fluentui/react-components";
import {
  ArrowDownload16Regular,
  Checkmark16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Info16Regular,
  ErrorCircle16Regular,
} from "@fluentui/react-icons";
import { Button, TextWithTooltip } from "../../../../../shared/components/ui";
import { CopyButton } from "../../../../../features/app-info/components/copy-button";
import {
  type JoinResult,
  CHECK_TARGETS,
  DISPLAY_LIMIT,
  filterWithCandidates,
} from "./types-join-check";

const useStyles = makeStyles({
  resultItem: {
    display: "flex",
    flexDirection: "column",
  },
  // 展開コンテンツのラッパー（インデントで親子関係を明示）
  expandedContent: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
  },
  // 結果ヘッダー（タイトル行・クリック可能）
  resultHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    padding: `${tokens.spacingVerticalXS} 0`,
    borderRadius: tokens.borderRadiusSmall,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  resultHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
  },
  checkSuccess: {
    color: tokens.colorPaletteGreenForeground1,
  },
  // テーブル
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  th: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    textAlign: "left",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: "middle",
    fontSize: tokens.fontSizeBase200,
  },
  tdNoWrap: {
    whiteSpace: "nowrap",
  },
  tableContainer: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  candidatesCell: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: "top",
  },
  candidatesList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  candidateItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
  },
  candidateAddress: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  sourceCountValue: {
    fontWeight: tokens.fontWeightSemibold,
  },
  candidateCount: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
    whiteSpace: "nowrap",
  },
  copyButtonWrapper: {
    color: tokens.colorNeutralForeground4,
    opacity: 0.7,
    ":hover": {
      opacity: 1,
    },
  },
  // 表示上限の案内カード
  limitInfoCard: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingVerticalM} ${tokens.spacingVerticalS} ${tokens.spacingVerticalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  limitInfoContent: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
  },
  limitInfoIcon: {
    flexShrink: 0,
    color: tokens.colorBrandForeground1,
  },
  limitInfoText: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  // セクション
  sectionContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  // エラー表示用
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    wordBreak: "break-word",
  },
  taskStatusError: {
    color: tokens.colorPaletteRedForeground1,
  },
});

type Props = {
  /** 結果データ */
  result: JoinResult;
  /** 展開状態 */
  isExpanded: boolean;
  /** 展開トグルハンドラ */
  onToggleExpand: () => void;
  /** CSVダウンロードハンドラ */
  onDownloadCsv: () => void;
};

export const JoinCheckResultItem = ({
  result,
  isExpanded,
  onToggleExpand,
  onDownloadCsv,
}: Props): JSX.Element => {
  const styles = useStyles();

  const targetInfo = CHECK_TARGETS.find((t) => t.key === result.target);
  const isError = result.status === "error";

  // 候補ありのみ抽出し、件数降順でソート（修正効果の大きいものを上位に）
  const withCandidates = useMemo(
    () => filterWithCandidates(result.unmatchedRecords),
    [result.unmatchedRecords],
  );
  const hasExpandableContent = withCandidates.length > 0;

  // エラー状態の場合
  if (isError) {
    return (
      <div className={styles.resultItem}>
        <div className={styles.errorContainer}>
          <div className={styles.resultHeaderLeft}>
            <ErrorCircle16Regular className={styles.taskStatusError} />
            <Caption1>{targetInfo?.label}</Caption1>
            <Badge appearance="filled" color="danger" size="small">
              エラー
            </Badge>
          </div>
          {result.errorMessage && (
            <Caption1 className={styles.errorText}>
              {result.errorMessage}
            </Caption1>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.resultItem}>
      {/* ヘッダー: タイトル + 件数詳細（クリックで折りたたみ） */}
      <div
        className={styles.resultHeader}
        onClick={() => hasExpandableContent && onToggleExpand()}
      >
        <div className={styles.resultHeaderLeft}>
          {hasExpandableContent ? (
            isExpanded ? (
              <ChevronDown16Regular />
            ) : (
              <ChevronRight16Regular />
            )
          ) : (
            <Checkmark16Regular className={styles.checkSuccess} />
          )}
          <Caption1>{targetInfo?.label}</Caption1>
        </div>
      </div>

      {/* テーブル: 未結合データ一覧（折りたたみ可能） */}
      {hasExpandableContent && isExpanded && (
        <div className={styles.expandedContent}>
          {/* 類似する住所が見つかったものセクション */}
          {withCandidates.length > 0 && (
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeader}>
                <Caption1 className={styles.sectionTitle}>
                  <TextWithTooltip
                    textNode={`表記ゆれの可能性がある住所（${withCandidates.length}件）`}
                    tooltipContent="水道データ内に表記が近い住所があります。同じ場所を指している場合は、元データの住所表記を揃えると名寄せ時に一致するようになります。"
                  />
                </Caption1>
                <Button
                  appearance="subtle"
                  icon={<ArrowDownload16Regular />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadCsv();
                  }}
                  size="small"
                >
                  CSVダウンロード
                </Button>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.th}>水道データに存在しない住所</th>
                      <th className={styles.th} style={{ textAlign: "right" }}>
                        該当件数
                      </th>
                      <th className={styles.th}>水道データの類似住所</th>
                      <th className={styles.th} style={{ textAlign: "right" }}>
                        該当件数
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {withCandidates
                      .slice(0, DISPLAY_LIMIT)
                      .map((record, idx) => (
                        <tr key={idx}>
                          <td className={`${styles.td} ${styles.tdNoWrap}`}>
                            {record.sourceAddress}
                          </td>
                          <td
                            className={`${styles.td} ${styles.tdNoWrap}`}
                            style={{ textAlign: "right" }}
                          >
                            <span className={styles.sourceCountValue}>
                              {record.sourceCount}
                            </span>
                          </td>
                          <td className={styles.candidatesCell}>
                            <div className={styles.candidatesList}>
                              {record.candidates.map((candidate, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={styles.candidateItem}
                                >
                                  <span className={styles.candidateAddress}>
                                    {candidate.address}
                                    <span className={styles.copyButtonWrapper}>
                                      <CopyButton value={candidate.address} />
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td
                            className={styles.candidatesCell}
                            style={{ textAlign: "right" }}
                          >
                            <div className={styles.candidatesList}>
                              {record.candidates.map((candidate, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={styles.candidateCount}
                                >
                                  {candidate.count}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* 表示上限の案内カード */}
              {withCandidates.length > DISPLAY_LIMIT && (
                <div className={styles.limitInfoCard}>
                  <div className={styles.limitInfoContent}>
                    <Info16Regular className={styles.limitInfoIcon} />
                    <div className={styles.limitInfoText}>
                      <Caption1Strong>
                        {withCandidates.length.toLocaleString()}
                        件中 {DISPLAY_LIMIT}件まで表示しています
                      </Caption1Strong>
                      <Caption1>
                        全件を確認するにはCSVをダウンロードしてください
                      </Caption1>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
