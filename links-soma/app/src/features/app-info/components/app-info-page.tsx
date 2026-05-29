import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  Text,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
import type { AppInfoData } from "../types";
import { formatters } from "../formatter";
import { CopyButton } from "./copy-button";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  heading: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase600,
  },
  cardsGrid: {
    display: "grid",
    gap: tokens.spacingVerticalL,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    gap: tokens.spacingVerticalXL,
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    gap: tokens.spacingHorizontalL,
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    gap: tokens.spacingVerticalL,
    textAlign: "center",
  },
  table: {
    width: "100%",
  },
  copyableValue: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    minHeight: "20px",
    wordBreak: "break-all",
  },
});

export const AppInfoPage = (): JSX.Element => {
  const styles = useStyles();
  const [appInfo, setAppInfo] = useState<AppInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppInfo = async (): Promise<void> => {
      try {
        const data = await window.ipcRenderer.invoke("appInfo");
        setAppInfo(data);
        rendererLogger.info("アプリ情報を取得しました", {
          dataKeys: Object.keys(data),
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "不明なエラー";
        setError(errorMessage);
        rendererLogger.error("アプリ情報の取得に失敗しました", err as Error);
      } finally {
        setLoading(false);
      }
    };

    void fetchAppInfo();
  }, []);

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingContainer}>
          <Spinner size="medium" />
          <Text>アプリケーション情報を読み込み中...</Text>
        </div>
      </div>
    );
  }

  if (error || !appInfo) {
    return (
      <div className={styles.root}>
        <div className={styles.errorContainer}>
          <Text size={500} weight="semibold">
            エラーが発生しました
          </Text>
          <Text>{error || "アプリケーション情報を取得できませんでした"}</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Text className={styles.heading} weight="semibold">
        アプリケーション情報
      </Text>

      <div className={styles.cardsGrid}>
        {/* ビルド情報 */}
        <Card>
          <CardHeader header={<Text weight="semibold">ビルド情報</Text>} />
          <div className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>項目</TableHeaderCell>
                  <TableHeaderCell>値</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>ビルド日時</TableCell>
                  <TableCell>
                    {formatters.date(appInfo.build.buildDate)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ビルド環境</TableCell>
                  <TableCell>
                    <span>{appInfo.build.environment}</span>
                  </TableCell>
                </TableRow>
                {appInfo.build.workflowRun && (
                  <TableRow>
                    <TableCell>ワークフロー実行番号</TableCell>
                    <TableCell>#{appInfo.build.workflowRun}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell>コミットハッシュ</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.build.commitHash}</span>
                      <CopyButton value={appInfo.build.commitHash} />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ブランチ</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.build.branch}</span>
                      <CopyButton value={appInfo.build.branch} />
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* ファイルシステム情報 */}
        <Card>
          <CardHeader
            header={<Text weight="semibold">ファイルシステム</Text>}
          />
          <div className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>項目</TableHeaderCell>
                  <TableHeaderCell>パス/サイズ</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>データベース</TableCell>
                  <TableCell>
                    <div>
                      <div className={styles.copyableValue}>
                        <Text size={200}>{appInfo.files.database.path}</Text>
                        <CopyButton value={appInfo.files.database.path} />
                      </div>
                      <Text size={200}>
                        {appInfo.files.database.exists
                          ? `サイズ: ${formatters.fileSize(appInfo.files.database.size)}`
                          : "ファイルが存在しません"}
                      </Text>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>地図タイル</TableCell>
                  <TableCell>
                    <div>
                      <div className={styles.copyableValue}>
                        <Text size={200}>{appInfo.files.pmtiles.path}</Text>
                        <CopyButton value={appInfo.files.pmtiles.path} />
                      </div>
                      <Text size={200}>
                        {appInfo.files.pmtiles.exists
                          ? `サイズ: ${formatters.fileSize(appInfo.files.pmtiles.size)}`
                          : "ファイルが存在しません"}
                      </Text>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>MLモデル</TableCell>
                  <TableCell>
                    <div>
                      <div className={styles.copyableValue}>
                        <Text size={200}>{appInfo.files.mlModels.path}</Text>
                        <CopyButton value={appInfo.files.mlModels.path} />
                      </div>
                      <Text size={200}>
                        {appInfo.files.mlModels.exists
                          ? `サイズ: ${formatters.fileSize(appInfo.files.mlModels.size)}`
                          : "ディレクトリが存在しません"}
                      </Text>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ログディレクトリ</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <Text size={200}>{appInfo.files.logsPath}</Text>
                      <CopyButton value={appInfo.files.logsPath} />
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* 基本情報 */}
        <Card>
          <CardHeader header={<Text weight="semibold">基本情報</Text>} />
          <div className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>項目</TableHeaderCell>
                  <TableHeaderCell>値</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>アプリ名</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.basic.name}</span>
                      <CopyButton value={appInfo.basic.name} />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>環境</TableCell>
                  <TableCell>
                    <span>{appInfo.basic.environment}</span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>プロセスID</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.basic.processId}</span>
                      <CopyButton value={appInfo.basic.processId.toString()} />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>データパス</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.basic.userDataPath}</span>
                      <CopyButton value={appInfo.basic.userDataPath} />
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* システム情報 */}
        <Card>
          <CardHeader header={<Text weight="semibold">システム情報</Text>} />
          <div className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>項目</TableHeaderCell>
                  <TableHeaderCell>値</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>OS</TableCell>
                  <TableCell>
                    {formatters.platform(appInfo.system.platform)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>アーキテクチャ</TableCell>
                  <TableCell>
                    {formatters.architecture(appInfo.system.arch)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>OSバージョン</TableCell>
                  <TableCell>{appInfo.system.osVersion}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>CPUコア数</TableCell>
                  <TableCell>{appInfo.system.cpuCores}コア</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>総メモリ</TableCell>
                  <TableCell>
                    {formatters.memory(appInfo.system.memory.total)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>利用可能メモリ</TableCell>
                  <TableCell>
                    {formatters.memory(appInfo.system.memory.available)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Node.jsバージョン</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.system.nodeVersion}</span>
                      <CopyButton value={appInfo.system.nodeVersion} />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Chromeバージョン</TableCell>
                  <TableCell>
                    <div className={styles.copyableValue}>
                      <span>{appInfo.system.chromeVersion}</span>
                      <CopyButton value={appInfo.system.chromeVersion} />
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};
