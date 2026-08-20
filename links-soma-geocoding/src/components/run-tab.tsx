/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  makeStyles,
  tokens,
  Card,
  TabList,
  Tab,
  TabValue,
  Button,
  Spinner,
} from "@fluentui/react-components";
import { useFormContext } from "react-hook-form";
import {
  testRun,
  GeocodingResult,
  RunResultSummary,
  FormValues,
  getGeocodingFunction,
  toGeocodingResultFromAbr,
  failedResult,
} from "../hooks/use-geocoding";
import {
  UNKNOWN_POSITION_LEVEL,
  summarizePositionLevels,
} from "../lib/position-level";
import Papa from "papaparse";

const useStyles = makeStyles({
  title: {
    margin: 0,
    fontWeight: tokens.fontWeightBold,
  },
  alert: {
    fontSize: tokens.fontSizeBase200,
  },
  tabContentWrapper: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    margin: `${tokens.spacingVerticalM}`,
  },
  buttonWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    justifyContent: "flex-end",
  },
  result: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    minHeight: "200px",
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    whiteSpace: "pre-wrap",
  },
  resultTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
  resultDetail: {
    marginTop: "16px",
  },
  resultList: {
    marginBottom: "8px",
  },
});

/**
 * RunTab:
 * - テスト実行（testRun）タブ => testSummaryに結果を保存
 * - 本番実行（run）タブ => runSummaryに結果を保存
 * - モック実行もテスト実行タブでのみ行い、testSummaryに反映
 */
export const RunTab = (): JSX.Element => {
  const styles = useStyles();

  // タブの状態
  const [selectedTab, setSelectedTab] = useState<TabValue>("testRun");

  // テスト実行結果（複数行用）
  const [testSummary, setTestSummary] = useState<RunResultSummary | null>(null);
  // テスト実行で1行のみの場合に表示したい単一の結果（あってもなくてもOK）
  const [testResult, setTestResult] = useState<GeocodingResult | null>(null);

  // 本番実行の結果
  const [runSummary, setRunSummary] = useState<RunResultSummary | null>(null);

  // フォームデータ
  const [latestFormData, setLatestFormData] = useState<FormValues | null>(null);

  // ローディング・完了件数・可視件数
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState<number>(50); // 段階的表示数

  const {
    handleSubmit,
    formState: { isValid },
    getValues,
    watch,
  } = useFormContext<FormValues>();

  // Watch form values to check if CSV is uploaded and column is selected
  const csvData = watch('csvData', []);
  const columns = watch('columns', {});
  const apiType = watch('apiType');
  const apiToken = watch('apiToken', '');
  const addressColumn = columns['住所に対応するカラムを選択'];
  
  // Check if CSV is uploaded, column is selected, and API token is provided (ABR doesn't need token)
  const hasApiCredentials = apiType === 'abr' 
    ? true // ABR doesn't need credentials, data is pre-downloaded
    : (apiToken && apiToken.trim() !== '');
  const isDataReady = csvData && csvData.length > 0 && addressColumn && addressColumn.trim() !== '' && hasApiCredentials;

  /**
   * モック実行（testRun用）
   */
  const handleMockTestRun = async () => {
    console.log("モック実行開始");
    setIsLoading(true);
    setCompletedCount(0);

    try {
      // フォーム値を取得 （あまり使わなくても、latestFormDataをnullにしないため）
      const data = getValues();
      setLatestFormData(data);

      // 10万件のモックデータ
      const MOCK_TOTAL = 100000;
      const batchSize = 1000;
      const batchCount = Math.ceil(MOCK_TOTAL / batchSize);

      const results: GeocodingResult[] = [];
      for (let b = 0; b < batchCount; b++) {
        const currentBatchSize = Math.min(
          batchSize,
          MOCK_TOTAL - b * batchSize
        );
        for (let i = 0; i < currentBatchSize; i++) {
          results.push({
            lat: 35.681236,
            lon: 139.767125,
            label: `モック${b * batchSize + i + 1}`,
            success: true,
            positionLevel: "号・地番",
            judgmentValue: "",
          });
        }
        setCompletedCount((b + 1) * batchSize);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const summary: RunResultSummary = {
        total: MOCK_TOTAL,
        successCount: MOCK_TOTAL,
        failCount: 0,
        results,
      };
      setTestSummary(summary);
      setTestResult(null);

      setVisibleCount(50);

      console.log("モック実行成功");
    } catch (error: any) {
      console.error("モック実行エラー:", error.message);
      setTestSummary(null);
      setTestResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * テスト実行 or 本番実行
   */
  const onSubmit = async (data: FormValues) => {
    console.log("Form Data:", data);
    setLatestFormData(data);
    setIsLoading(true);
    setCompletedCount(0);

    try {
      if (selectedTab === "testRun") {
        // テスト実行: CSVの一行目のみ
        const result = await testRun(data);

        // 単一行結果 => testResult に表示
        setTestResult(result);

        // RunResultSummary風にして複数行対応も可能
        const testSummaryLocal: RunResultSummary = {
          total: 1,
          successCount: result.success ? 1 : 0,
          failCount: result.success ? 0 : 1,
          results: [result],
        };
        setTestSummary(testSummaryLocal);

        // Update completed count only if successful
        if (result.success) {
          setCompletedCount(1);
        }

        // runSummary は上書きしない
        setRunSummary(null);
        setVisibleCount(50);
      } else if (selectedTab === "run") {
        // 本番実行
        const { apiType, apiToken, csvData, columns } = data;
        const addressColumn = columns["住所に対応するカラムを選択"];
        const geocodeFunc = getGeocodingFunction(apiType);

        // Use appropriate token based on API type (ABR doesn't need token)
        const tokenOrEmpty = apiType === 'abr' ? '' : apiToken;

        const results: GeocodingResult[] = [];
        
        if (apiType === 'ntt') {
          // NTT: Run sequentially like Python code
          // Rate limiting: 0.2 seconds between each request (rate_limit_sleep = 0.2)
          for (const [index, address] of csvData
            .map((row) => row[addressColumn])
            .entries()) {
            const r = await geocodeFunc(address, tokenOrEmpty);
            results.push(r);
            setCompletedCount(index + 1);
            
            // Rate limiting: 0.2 seconds between requests (like Python code line 342-344)
            if (index < csvData.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        } else if (apiType === 'abr') {
          // ABR: Use batch geocode for better performance
          const addresses = csvData.map((row) => row[addressColumn]);
          const batchSize = 100;
          let completedSoFar = 0;
          
          for (let batchStart = 0; batchStart < addresses.length; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, addresses.length);
            const batch = addresses.slice(batchStart, batchEnd);
            
            // Use batch geocode (single process call for entire batch)
            if (typeof window !== 'undefined' && window.electronAPI) {
              const batchResults = await window.electronAPI.abr.geocodeBatch(batch);
              
              // Convert to GeocodingResult format
              const convertedResults: GeocodingResult[] = batchResults.map(
                (r, offset) => toGeocodingResultFromAbr(r, batch[offset])
              );
              
              // Add results in order
              results.push(...convertedResults);
              
              // Update completed count after batch completes
              completedSoFar += convertedResults.length;
              setCompletedCount(completedSoFar);
            } else {
              // Fallback to individual calls if batch not available
              const batchPromises = batch.map((address) => 
                geocodeFunc(address, tokenOrEmpty)
              );
              const batchResults = await Promise.all(batchPromises);
              results.push(...batchResults);
              completedSoFar += batchResults.length;
              setCompletedCount(completedSoFar);
            }
          }
        } else {
          // AWS, Zenrin: Run sequentially
          for (const [index, address] of csvData
            .map((row) => row[addressColumn])
            .entries()) {
            const r = await geocodeFunc(address, tokenOrEmpty);
            results.push(r);
            setCompletedCount(index + 1);
          }
        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        const summary: RunResultSummary = {
          total: results.length,
          successCount,
          failCount,
          results,
        };
        setRunSummary(summary);

        // テスト用は消す
        setTestSummary(null);
        setTestResult(null);

        setVisibleCount(50);

        localStorage.setItem("runResultSummary", JSON.stringify(summary));
      }
    } catch (error: any) {
      console.error(error.message);
      if (selectedTab === "testRun") {
        setTestSummary(null);
        setTestResult(null);
      } else {
        setRunSummary(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * さらに読み込み
   */
  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 100);
  };

  /**
   * CSVダウンロード（本番実行結果用）
   */
  const handleDownload = () => {
    if (!runSummary) {
      console.warn("本番実行結果がありません");
      return;
    }
    const formData = getValues();
    const { csvData } = formData;

    // 全行・全ジオコーダで同一の列構成にする。PapaParse は 1 行目のキーだけで
    // ヘッダーを決めるため、値の有無で列を出し分けると列そのものが消える。
    const updatedData = csvData.map((row, index) => {
      const result = runSummary.results[index] ?? failedResult("範囲外");

      return {
        ...row,
        緯度: result.success ? result.lat : "",
        経度: result.success ? result.lon : "",
        ジオコーディング住所: result.success ? result.label : "",
        位置レベル: result.success ? result.positionLevel : UNKNOWN_POSITION_LEVEL,
        判定値: result.success ? result.judgmentValue : "",
        エラーメッセージ: result.success
          ? ""
          : result.errorMessage || "原因不明のエラー",
      };
    });

    // CSV文字列へ変換し、BOMを付与
    const csvString = Papa.unparse(updatedData);
    const bom = "\ufeff";
    const blob = new Blob([bom + csvString], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "geocoded_data.csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * テストタブ用の表示
   */
  const renderTestSummary = () => {
    if (!testSummary) {
      // 単行結果を表示
      if (testResult) {
        if (testResult.success) {
          return `テスト実行成功！\n座標: (${testResult.lat}, ${testResult.lon})\nラベル: ${testResult.label}`;
        } else {
          return `テスト実行失敗: ${
            testResult.errorMessage || "原因不明のエラー"
          }`;
        }
      }
      return "まだ実行されていません";
    }

    const visibleResults = testSummary.results.slice(0, visibleCount);

    return (
      <div>
        <div>
          <strong>総数:</strong> {testSummary.total}
        </div>
        <div>
          <strong>成功数:</strong> {testSummary.successCount}
        </div>
        <div>
          <strong>失敗数:</strong> {testSummary.failCount}
        </div>

        <div className={styles.resultDetail}>
          <strong>テスト実行／モック実行結果:</strong>
          <ul>
            {visibleResults.map((r, idx) => (
              <li key={idx} className={styles.resultList}>
                ラベル: {r.label}, 座標: ({r.lat}, {r.lon})
              </li>
            ))}
          </ul>
          {visibleCount < testSummary.total && (
            <Button appearance="secondary" onClick={handleLoadMore}>
              さらに読み込み
            </Button>
          )}
        </div>
      </div>
    );
  };

  /**
   * 位置レベルの内訳。緯度経度がどの住所階層の代表点かを件数で示す。
   * 「号・地番」の割合が、座標が建物にどれだけ近いかの指標になる。
   */
  const renderPositionLevelBreakdown = (summary: RunResultSummary) => {
    const breakdown = summarizePositionLevels(summary.results);
    if (breakdown.length === 0) return null;

    return (
      <div className={styles.resultDetail}>
        <strong>位置レベルの内訳:</strong>
        <ul>
          {breakdown.map(({ level, count, ratio }) => (
            <li key={level} className={styles.resultList}>
              {level}: {count}件 ({(ratio * 100).toFixed(1)}%)
            </li>
          ))}
        </ul>
      </div>
    );
  };

  /**
   * 本番実行の表示
   */
  const renderRunSummary = () => {
    if (!runSummary) return "まだ実行されていません";
    if (!latestFormData) return "フォームデータが利用できません";

    const visibleResults = runSummary.results.slice(0, visibleCount);

    return (
      <div>
        <div>
          <strong>総数:</strong> {runSummary.total}
        </div>
        <div>
          <strong>成功数:</strong> {runSummary.successCount}
        </div>
        <div>
          <strong>失敗数:</strong> {runSummary.failCount}
        </div>

        {renderPositionLevelBreakdown(runSummary)}

        <div className={styles.resultDetail}>
          <strong>本番実行結果:</strong>
          <ul>
            {visibleResults.map((r, idx) => (
              <li key={idx} className={styles.resultList}>
                ラベル: {r.label}, 座標: ({r.lat}, {r.lon})
              </li>
            ))}
          </ul>
          {visibleCount < runSummary.total && (
            <Button appearance="secondary" onClick={handleLoadMore}>
              さらに読み込み
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <div className={styles.title}>実行</div>
      <div>
        <div className={styles.alert}>
          ※
          テスト実行：CSVの1行目のデータのみを使用して、ジオコーディングが正常に動作するかを確認します。
        </div>

        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value)}
        >
          <Tab value="testRun">テスト実行</Tab>
          <Tab value="run">本番実行</Tab>
        </TabList>

        {/* テストタブ */}
        {selectedTab === "testRun" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={styles.tabContentWrapper}
          >
            <div className={styles.buttonWrapper}>
              <Button type="submit" disabled={!isValid || !isDataReady || isLoading}>
                テスト実行
              </Button>
              <Button
                onClick={handleMockTestRun}
                disabled={isLoading}
                appearance="secondary"
              >
                モック実行
              </Button>
              <Button disabled={!isValid || !isDataReady || isLoading}>前回途中から実行</Button>
            </div>

            <div className={styles.result}>
              <div className={styles.resultTitle}>テスト実行結果</div>
              {isLoading ? (
                <>
                  <Spinner label="実行中..." size="medium" />
                  <div style={{ marginTop: "8px" }}>
                    完了件数: {completedCount} / 1
                  </div>
                </>
              ) : (
                // testSummary の表示
                renderTestSummary()
              )}
              {testSummary && !isLoading && (
                <div style={{ marginTop: "8px" }}>
                  完了件数: {completedCount} / {testSummary.total}
                </div>
              )}
            </div>
          </form>
        )}

        {/* 本番実行タブ */}
        {selectedTab === "run" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className={styles.tabContentWrapper}
          >
            <div className={styles.buttonWrapper}>
              <Button type="submit" disabled={!isValid || !isDataReady || isLoading}>
                実行
              </Button>
              <Button disabled={!isValid || !isDataReady || isLoading}>前回途中から実行</Button>
              <Button
                onClick={handleDownload}
                type="button"
                disabled={!runSummary || isLoading}
              >
                ダウンロード
              </Button>
            </div>

            <div className={styles.result}>
              <div className={styles.resultTitle}>本番実行結果</div>
              {isLoading ? (
                <>
                  <Spinner label="実行中..." size="medium" />
                  {csvData && csvData.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      完了件数: {completedCount} / {csvData.length}
                    </div>
                  )}
                </>
              ) : (
                // runSummary の表示
                renderRunSummary()
              )}
              {runSummary && !isLoading && (
                <div style={{ marginTop: "8px" }}>
                  完了件数: {completedCount} / {runSummary.total}
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};
