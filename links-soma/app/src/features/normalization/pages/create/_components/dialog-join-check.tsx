/**
 * 住所の表記ゆれチェックダイアログ
 * 名寄せ処理前に結合を試行し、結合できなかった住所を確認するためのダイアログ
 *
 * @description
 * - 各データセットの住所が水道データに結合できるかを事前にチェック
 * - 結合できなかった住所に対して、水道データから候補を提示
 * - ユーザーは結果をCSVでダウンロードし、元データを修正して再実行できる
 */

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  makeStyles,
  tokens,
  Checkbox,
  Caption1,
  Caption1Strong,
  Badge,
  DialogTitle,
} from "@fluentui/react-components";
import { type SelectJob } from "../../../../../db/schema";
import {
  type JoinCheckTarget,
  type JoinCheckParameters,
  type DraftPreprocessParameters,
} from "../../../../../shared/types/job-parameters";
import { rendererLogger } from "../../../../../shared/utils/renderer-logger";
import {
  Button,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
} from "../../../../../shared/components/ui";
import { downloadObjectsAsCSV } from "../../../../../shared/utils/download-objects-as-csv";
import {
  type JoinResult,
  type DialogState,
  type DatasetInfo,
  type UnmatchedRecord,
  CHECK_TARGETS,
  filterWithCandidates,
} from "./types-join-check";
import { useJoinCheckPolling } from "./use-join-check-polling";
import { JoinCheckProgress } from "./join-check-progress";
import { JoinCheckResultItem } from "./join-check-result-item";

// 型の再エクスポート（既存のインポート元との互換性維持）
export type { JoinResult, DatasetInfo } from "./types-join-check";

// =============================================================================
// スタイル
// =============================================================================

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: "800px",
    minWidth: "700px",
  },
  dialogTitleContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingVerticalXXL} ${tokens.spacingVerticalM} ${tokens.spacingVerticalXXL} `,
    gridArea: "1 / 1 / 2 / 4",
  },
  dialogTitleText: {
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  dialogTitleDescription: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
  },
  dialogContent: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  sectionTitle: {
    color: tokens.colorNeutralForeground3,
  },
  checkboxList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  checkboxItem: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  addressColumnInfo: {
    paddingLeft: "26px",
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
  },
  unconfiguredBadge: {
    marginLeft: tokens.spacingHorizontalS,
  },
  resultNotes: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase200,
  },
  resultList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
});

// =============================================================================
// コンポーネント
// =============================================================================

type Props = {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるハンドラ */
  onClose: () => void;
  /** 設定済みのデータセット（チェック対象として選択可能にする） */
  configuredDatasets: JoinCheckTarget[];
  /** 前回のチェック結果（親コンポーネントで保持） */
  previousResults: JoinResult[];
  /** チェック結果の更新ハンドラ */
  onResultsChange: (results: JoinResult[]) => void;
  /** 前回の展開状態（親コンポーネントで保持） */
  previousExpandedTargets: Set<JoinCheckTarget>;
  /** 展開状態の更新ハンドラ */
  onExpandedTargetsChange: (expanded: Set<JoinCheckTarget>) => void;
  /** 水道データ情報（必須・結合基準） */
  waterStatusDataset: DatasetInfo;
  /** 各データセットの情報 */
  datasetInfoMap: Partial<Record<JoinCheckTarget, DatasetInfo>>;
  /** 下書きjobのID（下書き時のみ。joinCheckJobIdの更新に使用） */
  draftJobId?: number;
  /** 市区町村名（住所正規化で先頭から除去する） */
  municipality: string;
};

export const DialogJoinCheck = ({
  open,
  onClose,
  configuredDatasets,
  previousResults,
  onResultsChange,
  previousExpandedTargets,
  onExpandedTargetsChange,
  waterStatusDataset,
  datasetInfoMap,
  draftJobId,
  municipality,
}: Props): JSX.Element => {
  const styles = useStyles();

  // 状態管理
  const [dialogState, setDialogState] = useState<DialogState>(() =>
    previousResults.length > 0 ? "completed" : "idle",
  );
  const [selectedTargets, setSelectedTargets] = useState<Set<JoinCheckTarget>>(
    () => new Set(configuredDatasets),
  );
  const [expandedTargets, setExpandedTargets] = useState<Set<JoinCheckTarget>>(
    () => new Set(previousExpandedTargets),
  );

  // 完了処理
  const handleCheckComplete = useCallback(
    (finalResults: JoinResult[]) => {
      // 1つ目の項目（未結合データがあれば）を初期展開
      const firstWithUnmatched = finalResults.find(
        (r) => r.unmatchedRecords.length > 0,
      );
      const newExpandedTargets = firstWithUnmatched
        ? new Set<JoinCheckTarget>([firstWithUnmatched.target])
        : new Set<JoinCheckTarget>();
      setExpandedTargets(newExpandedTargets);
      onExpandedTargetsChange(newExpandedTargets);

      onResultsChange(finalResults);
      setDialogState("completed");
    },
    [onExpandedTargetsChange, onResultsChange],
  );

  // エラー処理
  const handleError = useCallback(
    (message: string, partialResults?: JoinResult[]) => {
      if (partialResults) {
        // 部分的に成功した結果がある場合
        handleCheckComplete(partialResults);
        void window.ipcRenderer.invoke("showErrorDialog", {
          title: "住所の表記ゆれチェック部分完了",
          message: `一部のデータセットでエラーが発生しました。\n\nエラー: ${message}\n\n成功したデータセットの結果は表示されています。`,
        });
      } else {
        setDialogState("idle");
        void window.ipcRenderer.invoke("showErrorDialog", {
          title: "住所の表記ゆれチェックエラー",
          message: `住所の表記ゆれチェック処理中にエラーが発生しました。\n\nエラー: ${message}`,
        });
      }
    },
    [handleCheckComplete],
  );

  // ポーリングフック
  const polling = useJoinCheckPolling({
    onComplete: handleCheckComplete,
    onError: handleError,
  });

  // 折りたたみトグル
  const handleToggleExpand = useCallback(
    (target: JoinCheckTarget) => {
      setExpandedTargets((prev) => {
        const next = new Set(prev);
        if (next.has(target)) {
          next.delete(target);
        } else {
          next.add(target);
        }
        onExpandedTargetsChange(next);
        return next;
      });
    },
    [onExpandedTargetsChange],
  );

  // チェックボックスのトグル
  const handleToggleTarget = useCallback((target: JoinCheckTarget) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
  }, []);

  // 状態をidle状態にリセット
  const resetToIdle = useCallback(() => {
    setDialogState("idle");
    polling.setResults([]);
    setExpandedTargets(new Set());
    setSelectedTargets(new Set(configuredDatasets));
  }, [configuredDatasets, polling]);

  // ダイアログオープン時に状態を復元
  useEffect(() => {
    if (!open) return;

    // 既にポーリング中の場合は状態をリセットしない
    if (polling.isPolling) {
      return;
    }

    // 前回結果がある場合は完了状態で復元
    if (previousResults.length > 0) {
      setDialogState("completed");
      polling.setResults(previousResults);
      setExpandedTargets(new Set(previousExpandedTargets));
      setSelectedTargets(new Set(configuredDatasets));
      return;
    }

    // draftJobIdがある場合、実行中のjobがあるか確認
    if (draftJobId) {
      void (async () => {
        try {
          const draftJob = (await window.ipcRenderer.invoke("selectJob", {
            id: draftJobId,
          })) as SelectJob | null;

          const params = draftJob?.parameters as
            | DraftPreprocessParameters
            | undefined;
          const joinCheckJobId = params?.joinCheckJobId;

          if (!joinCheckJobId) {
            resetToIdle();
            return;
          }

          const joinCheckJob = (await window.ipcRenderer.invoke("selectJob", {
            id: joinCheckJobId,
          })) as SelectJob | null;

          if (!joinCheckJob) {
            resetToIdle();
            return;
          }

          // 実行中の場合、ポーリングを再開
          if (joinCheckJob.status === "") {
            const jobParams =
              joinCheckJob.parameters as JoinCheckParameters | null;
            const targets: JoinCheckTarget[] = [];
            if (jobParams?.data?.resident_registry) {
              targets.push("resident_registry");
            }
            if (jobParams?.data?.building_registry) {
              targets.push("building_registry");
            }
            if (jobParams?.data?.geocoding) {
              targets.push("geocoding");
            }
            if (jobParams?.data?.building_type_determination) {
              targets.push("building_type_determination");
            }
            if (jobParams?.data?.vacant_house) {
              targets.push("vacant_house");
            }
            if (jobParams?.data?.optional_data_source) {
              targets.push("optional_data_source");
            }

            if (targets.length > 0) {
              const initialResults: JoinResult[] = targets.map((target) => ({
                target,
                status: "running" as const,
                unmatchedRecords: [],
              }));
              polling.setResults(initialResults);
              setDialogState("checking");
              setSelectedTargets(new Set(targets));

              polling.startPolling(joinCheckJobId, targets);
              rendererLogger.info(
                "住所の表記ゆれチェックのポーリングを再開しました",
                { jobId: joinCheckJobId, targets },
              );
              return;
            }
          }

          // 完了またはエラーの場合はidle状態
          resetToIdle();
        } catch (error) {
          rendererLogger.error(
            "住所の表記ゆれチェック状態の復元に失敗しました",
            error as Error,
          );
          resetToIdle();
        }
      })();
    } else {
      resetToIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling, resetToIdleは意図的に除外。pollingオブジェクト全体を依存に入れると参照変更で不要な再実行が発生する（setResultsはuseStateのsetterで安定、startPollingは実行時に最新版を参照）。resetToIdleはpollingに依存するため同様。代替案（インライン化、useRef）は複雑さが増すため不採用。
  }, [
    open,
    previousResults,
    previousExpandedTargets,
    configuredDatasets,
    draftJobId,
  ]);

  // チェック実行
  const handleExecuteCheck = useCallback(async () => {
    const targets = Array.from(selectedTargets);

    // 初期状態を設定（全てpending）
    const initialResults: JoinResult[] = targets.map((target) => ({
      target,
      status: "pending",
      unmatchedRecords: [],
    }));

    polling.setResults(initialResults);
    setDialogState("checking");

    try {
      // データセット情報を構築
      const dataConfig: JoinCheckParameters["data"] = {
        water_status: {
          path: waterStatusDataset.path,
          columns: { address: waterStatusDataset.addressColumn },
        },
      };

      for (const target of targets) {
        const info = datasetInfoMap[target];
        if (info) {
          dataConfig[target] = {
            path: info.path,
            columns: { address: info.addressColumn },
          };
        }
      }

      // IF005を呼び出してジョブを開始
      const response = await window.ipcRenderer.invoke("execIF005JoinCheck", {
        parameters: {
          parameterType: "join_check",
          settings: {
            max_number: "10",
            municipality,
          },
          data: dataConfig,
        } satisfies Omit<JoinCheckParameters, "output_path" | "database_path">,
        draftJobId,
      });

      if (!response || !response.jobId) {
        rendererLogger.error(
          "住所の表記ゆれチェックの開始に失敗しました",
          undefined,
          {
            response,
          },
        );
        setDialogState("idle");
        await window.ipcRenderer.invoke("showErrorDialog", {
          title: "住所の表記ゆれチェックエラー",
          message:
            "住所の表記ゆれチェックの開始に失敗しました。\n実行ファイルが見つからない可能性があります。",
        });
        return;
      }

      rendererLogger.info("住所の表記ゆれチェックを開始しました", {
        jobId: response.jobId,
        targets,
      });

      // ポーリング開始
      polling.startPolling(response.jobId, targets);
    } catch (e) {
      rendererLogger.error(
        "住所の表記ゆれチェックの呼び出しに失敗しました",
        e as Error,
      );
      setDialogState("idle");
      await window.ipcRenderer.invoke("showErrorDialog", {
        title: "住所の表記ゆれチェックエラー",
        message:
          "住所の表記ゆれチェックの呼び出しに失敗しました。\n実行ファイルが見つからない可能性があります。",
      });
    }
  }, [
    selectedTargets,
    waterStatusDataset,
    datasetInfoMap,
    draftJobId,
    municipality,
    polling,
  ]);

  // 再実行（選択画面に戻る）
  const handleRerun = useCallback(() => {
    setDialogState("idle");
    setSelectedTargets(new Set(configuredDatasets));
  }, [configuredDatasets]);

  // CSVダウンロード
  const handleDownloadCsv = useCallback(
    (
      target: JoinCheckTarget,
      unmatchedRecords: UnmatchedRecord[],
      suffix: string,
    ) => {
      const targetInfo = CHECK_TARGETS.find((t) => t.key === target);
      const targetLabel = targetInfo?.label ?? target;

      const rows: Array<{
        水道データに存在しない住所: string;
        該当件数: number;
        水道データの類似住所: string;
        水道データ類似住所の該当件数: number;
      }> = [];

      for (const record of unmatchedRecords) {
        for (const candidate of record.candidates) {
          rows.push({
            水道データに存在しない住所: record.sourceAddress,
            該当件数: record.sourceCount,
            水道データの類似住所: candidate.address,
            水道データ類似住所の該当件数: candidate.count,
          });
        }
      }

      const fileName = `住所の表記ゆれチェック_${targetLabel}_${suffix}`;
      downloadObjectsAsCSV(rows, fileName);
    },
    [],
  );

  // ダイアログを閉じる
  // 注意: ポーリングは意図的に停止しない。
  // チェック実行中にダイアログを閉じても、バックグラウンドで完了を待ち、
  // 再度開いた時に結果を表示するため（polling.isPolling ガードで状態を維持）。
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog onOpenChange={(_, data) => !data.open && handleClose()} open={open}>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <div className={styles.dialogTitleContainer}>
            <DialogTitle className={styles.dialogTitleText}>
              住所の表記ゆれチェック
            </DialogTitle>
            <Caption1 className={styles.dialogTitleDescription}>
              各データに含まれる住所（町字名）のうち、水道データに存在しない住所を抽出します。該当する住所については、元データの表記を修正することで、名寄せ処理での結合率が改善できる可能性があります。
            </Caption1>
          </div>

          <DialogContent border className={styles.dialogContent}>
            {dialogState === "idle" && (
              <div className={styles.section}>
                <Caption1Strong className={styles.sectionTitle}>
                  チェック対象を選択してください
                </Caption1Strong>
                <div className={styles.checkboxList}>
                  {CHECK_TARGETS.map((target) => {
                    const isConfigured = configuredDatasets.includes(
                      target.key,
                    );
                    const datasetInfo = datasetInfoMap[target.key];
                    return (
                      <div key={target.key} className={styles.checkboxItem}>
                        <Checkbox
                          checked={selectedTargets.has(target.key)}
                          disabled={!isConfigured}
                          label={
                            <span>
                              {target.label}
                              {!isConfigured && (
                                <Badge
                                  appearance="outline"
                                  className={styles.unconfiguredBadge}
                                  color="subtle"
                                  size="small"
                                >
                                  未設定
                                </Badge>
                              )}
                            </span>
                          }
                          onChange={() => handleToggleTarget(target.key)}
                        />
                        {isConfigured && datasetInfo && (
                          <Caption1 className={styles.addressColumnInfo}>
                            住所カラム: {datasetInfo.addressColumn}
                          </Caption1>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {dialogState === "checking" && (
              <JoinCheckProgress results={polling.results} />
            )}

            {dialogState === "completed" && (
              <div className={styles.section}>
                <div className={styles.resultList}>
                  {polling.results.map((result) => (
                    <JoinCheckResultItem
                      key={result.target}
                      isExpanded={expandedTargets.has(result.target)}
                      onDownloadCsv={() =>
                        handleDownloadCsv(
                          result.target,
                          filterWithCandidates(result.unmatchedRecords),
                          "表記ゆれ候補",
                        )
                      }
                      onToggleExpand={() => handleToggleExpand(result.target)}
                      result={result}
                    />
                  ))}
                </div>
                <div className={styles.resultNotes}>
                  <span>
                    ※住所の表記ゆれを確認するための参考情報です。結合できない原因の特定や、名寄せ結果の予測はできません
                  </span>
                  <span>
                    ※名寄せ処理では水道データの住所をマスタとして各データとの結合を行います
                  </span>
                  <span>
                    ※表記の修正は本システム外で行い、修正後に再度アップロードしてください
                  </span>
                </div>
              </div>
            )}
          </DialogContent>

          <DialogActions>
            {dialogState === "idle" && (
              <>
                <Button appearance="outline" onClick={handleClose}>
                  キャンセル
                </Button>
                <Button
                  appearance="primary"
                  disabled={selectedTargets.size === 0}
                  onClick={handleExecuteCheck}
                >
                  チェック実行
                </Button>
              </>
            )}
            {dialogState === "completed" && (
              <>
                <Button appearance="outline" onClick={handleRerun}>
                  再実行
                </Button>
                <Button appearance="primary" onClick={handleClose}>
                  閉じる
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
