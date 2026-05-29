import { createReadStream } from "fs";
import { type IpcMainInvokeEvent } from "electron";
import { parse } from "csv-parse";
import { eq } from "drizzle-orm";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  data_set_results,
  type InsertDataSetDetailArea,
  type InsertDataSetDetailBuilding,
} from "../../../db/schema";
import { type FileData } from "../components/dataset/dialog-create-result-dataset/type";
import {
  isEnglishColumn,
  translateColumnToEnglish,
  type DatasetType,
} from "../../../shared/column-translation-utils";
import {
  CSV_IMPORT_PROGRESS_CHANNEL,
  type CsvImportProgress,
  type CsvImportResult,
} from "../../../shared/csv-import-progress";
import { db } from "../../../db/client";
import { formatDate } from "../../../shared/utils/format-date";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { collectOdsColumns } from "../util/collect-ods-columns";
import { ODS_SUFFIX } from "../../../shared/types/optional-data-source";

/** バッチサイズ: 100行ずつINSERT */
const BATCH_SIZE = 100;

/** 進捗通知の間隔: 5000行ごと */
const PROGRESS_INTERVAL = 5000;

/**
 * CSVパースエラーメッセージをユーザーフレンドリーな形式に変換
 */
const formatCsvErrorMessage = (originalMessage: string): string => {
  // Invalid Record Length: columns length is 151, got 155 on line 18016
  const columnMismatchMatch = originalMessage.match(
    /Invalid Record Length: columns length is (\d+), got (\d+) on line (\d+)/,
  );
  if (columnMismatchMatch) {
    const expected = columnMismatchMatch[1];
    const actual = columnMismatchMatch[2];
    const line = columnMismatchMatch[3];
    return `${line}行目でエラー: カラム数が一致しません（期待: ${expected}列、実際: ${actual}列）`;
  }

  // Quote関連のエラー
  if (originalMessage.toLowerCase().includes("quote")) {
    const lineMatch = originalMessage.match(/on line (\d+)/i);
    const line = lineMatch ? lineMatch[1] : "不明";
    return `${line}行目でエラー: 引用符の対応が不正です`;
  }

  // その他のエラーはそのまま返す
  return originalMessage;
};

/**
 * SQLiteエラーメッセージをユーザーフレンドリーな形式に変換
 */
const formatDbErrorMessage = (originalMessage: string): string => {
  // NOT NULL constraint failed: data_set_detail_areas.geometry
  const notNullMatch = originalMessage.match(
    /NOT NULL constraint failed: [\w_]+\.(\w+)/,
  );
  if (notNullMatch) {
    const column = notNullMatch[1];
    return `${column} カラムに値がない行があります`;
  }

  // UNIQUE constraint failed
  if (originalMessage.includes("UNIQUE constraint failed")) {
    return "重複するデータがあります";
  }

  // その他のエラー
  return `データベースエラー: ${originalMessage}`;
};

type Params = {
  buildingFile: FileData | null;
  areaFile: FileData | null;
};

/** パース済みCSVデータの型 */
type ParsedCsvData = {
  rows: Record<string, unknown>[];
  headers: string[];
  unmappedColumns: string[];
};

/**
 * アップロードファイルからタイトルを生成する
 * 形式: [種別]推定結果_[ファイル名]_[日時]
 */
const generateTitle = (
  buildingFile: FileData | null,
  areaFile: FileData | null,
): string => {
  const dateTime = formatDate(new Date(), "YYYY-MM-DD_HH:mm");

  // ファイル名から拡張子を除去
  const removeExtension = (fileName: string): string =>
    fileName.replace(/\.[^.]+$/, "");

  if (buildingFile && areaFile) {
    const buildingName = removeExtension(buildingFile.name);
    const areaName = removeExtension(areaFile.name);
    return `推定結果_${buildingName}_${areaName}_${dateTime}`;
  }

  if (buildingFile) {
    const buildingName = removeExtension(buildingFile.name);
    return `建物推定結果_${buildingName}_${dateTime}`;
  }

  if (areaFile) {
    const areaName = removeExtension(areaFile.name);
    return `地域推定結果_${areaName}_${dateTime}`;
  }

  // フォールバック（通常は到達しない）
  return `推定結果データ_${dateTime}`;
};

export const createResultDatasets = (async (
  event: IpcMainInvokeEvent,
  { buildingFile, areaFile }: Params,
): Promise<CsvImportResult | undefined> => {
  const title = generateTitle(buildingFile, areaFile);

  /** 進捗をレンダラーに送信するヘルパー */
  const sendProgress = (progress: CsvImportProgress): void => {
    event.sender.send(CSV_IMPORT_PROGRESS_CHANNEL, progress);
  };

  // Phase 1: CSVをパースしてメモリに読み込む（DBには書き込まない）
  let buildingData: ParsedCsvData | null = null;
  let areaData: ParsedCsvData | null = null;

  // 1-1. 建物CSVのパース
  if (buildingFile) {
    try {
      buildingData = await parseCsvToMemory(
        buildingFile,
        "building",
        (rowCount) => {
          sendProgress({ phase: "parsing", fileType: "building", rowCount });
        },
      );

      // 行数0の検証
      if (buildingData.rows.length === 0) {
        sendProgress({
          phase: "error",
          fileType: "building",
          message: "CSVファイルにデータがありません（0行）",
        });
        mainProcessLogger.error(
          `CSV validation failed - fileName: ${buildingFile.name}, reason: 0 rows`,
        );
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ファイルの読み込みに失敗しました";
      sendProgress({ phase: "error", fileType: "building", message });
      mainProcessLogger.error(
        `CSV parse failed - fileName: ${buildingFile.name}`,
        error as Error,
      );
      return;
    }
  }

  // 1-2. 地域CSVのパース
  if (areaFile) {
    try {
      areaData = await parseCsvToMemory(areaFile, "area", (rowCount) => {
        sendProgress({ phase: "parsing", fileType: "area", rowCount });
      });

      // 行数0の検証
      if (areaData.rows.length === 0) {
        sendProgress({
          phase: "error",
          fileType: "area",
          message: "CSVファイルにデータがありません（0行）",
        });
        mainProcessLogger.error(
          `CSV validation failed - fileName: ${areaFile.name}, reason: 0 rows`,
        );
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ファイルの読み込みに失敗しました";
      sendProgress({ phase: "error", fileType: "area", message });
      mainProcessLogger.error(
        `CSV parse failed - fileName: ${areaFile.name}`,
        error as Error,
      );
      return;
    }
  }

  // Phase 2: 全てのパースが成功したらDBに書き込む
  const { dataSetResultsId } = db
    .insert(data_set_results)
    .values({ title })
    .returning({ dataSetResultsId: data_set_results.id })
    .get();

  /** エラー時に親レコードと関連する子レコードを削除するヘルパー */
  const cleanupOnError = (): void => {
    try {
      db.transaction((tx) => {
        // 子テーブルを先に削除
        tx.delete(data_set_detail_buildings)
          .where(
            eq(data_set_detail_buildings.data_set_result_id, dataSetResultsId),
          )
          .run();
        tx.delete(data_set_detail_areas)
          .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultsId))
          .run();
        // 親テーブルを削除
        tx.delete(data_set_results)
          .where(eq(data_set_results.id, dataSetResultsId))
          .run();
      });
      mainProcessLogger.info(
        `Cleanup: deleted data_set_results id=${dataSetResultsId} and related records due to insert error`,
      );
    } catch (cleanupError) {
      mainProcessLogger.error(
        `Cleanup failed: could not delete data_set_results id=${dataSetResultsId}`,
        cleanupError as Error,
      );
    }
  };

  // 2-1. 建物データのINSERT
  if (buildingFile && buildingData) {
    try {
      await insertParsedData({
        fileData: buildingFile,
        parsedData: buildingData,
        datasetType: "building",
        dataSetResultId: dataSetResultsId,
        table: data_set_detail_buildings,
        sendProgress,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? formatDbErrorMessage(error.message)
          : "データベースへの保存に失敗しました";
      sendProgress({ phase: "error", fileType: "building", message });
      mainProcessLogger.error(
        `DB insert failed - fileName: ${buildingFile.name}`,
        error as Error,
      );
      cleanupOnError();
      return;
    }
  }

  // 2-2. 地域データのINSERT
  if (areaFile && areaData) {
    try {
      await insertParsedData({
        fileData: areaFile,
        parsedData: areaData,
        datasetType: "area",
        dataSetResultId: dataSetResultsId,
        table: data_set_detail_areas,
        sendProgress,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? formatDbErrorMessage(error.message)
          : "データベースへの保存に失敗しました";
      sendProgress({ phase: "error", fileType: "area", message });
      mainProcessLogger.error(
        `DB insert failed - fileName: ${areaFile.name}`,
        error as Error,
      );
      cleanupOnError();
      return;
    }
  }

  // 結果を返す
  return {
    title,
    building:
      buildingFile && buildingData
        ? {
            fileName: buildingFile.name,
            rowCount: buildingData.rows.length,
            unmappedColumns: buildingData.unmappedColumns,
          }
        : null,
    area:
      areaFile && areaData
        ? {
            fileName: areaFile.name,
            rowCount: areaData.rows.length,
            unmappedColumns: areaData.unmappedColumns,
          }
        : null,
  };
}) satisfies IpcMainListener;

type InsertParsedDataParams = {
  fileData: FileData;
  parsedData: ParsedCsvData;
  datasetType: DatasetType;
  dataSetResultId: number;
  table: typeof data_set_detail_buildings | typeof data_set_detail_areas;
  sendProgress: (progress: CsvImportProgress) => void;
};

/**
 * パース済みのデータをDBにINSERTする
 */
const insertParsedData = async ({
  fileData,
  parsedData,
  datasetType,
  dataSetResultId,
  table,
  sendProgress,
}: InsertParsedDataParams): Promise<void> => {
  const startTime = Date.now();

  // data_set_result_idとreference_dateを各行に追加
  const rowsWithId = parsedData.rows.map((row) => ({
    ...row,
    data_set_result_id: dataSetResultId,
    reference_date: (row.reference_date as string) || "",
  }));

  db.transaction(() => {
    for (let i = 0; i < rowsWithId.length; i += BATCH_SIZE) {
      const batch = rowsWithId.slice(i, i + BATCH_SIZE);
      db.insert(table)
        .values(
          batch as (InsertDataSetDetailBuilding | InsertDataSetDetailArea)[],
        )
        .run();

      const currentProgress = Math.min(i + BATCH_SIZE, rowsWithId.length);

      // 進捗通知（5000行ごと）
      if (
        currentProgress % PROGRESS_INTERVAL === 0 ||
        currentProgress >= rowsWithId.length
      ) {
        sendProgress({
          phase: "inserting",
          fileType: datasetType,
          current: currentProgress,
          total: rowsWithId.length,
        });
      }

      // ログ出力（10000行ごと）
      if (
        currentProgress % 10000 === 0 ||
        currentProgress >= rowsWithId.length
      ) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        mainProcessLogger.info(
          `Insert progress - fileName: ${fileData.name}, inserted: ${currentProgress}/${rowsWithId.length}, elapsed: ${elapsed}s`,
        );
      }
    }
  });

  // 完了通知
  sendProgress({ phase: "completed", fileType: datasetType });

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  mainProcessLogger.info(
    `Insert completed - fileName: ${fileData.name}, totalRows: ${rowsWithId.length}, elapsed: ${totalElapsed}s`,
  );
};

/**
 * CSVファイルをパースしてメモリに読み込む
 * パフォーマンス最適化: カラムマッピングを最初のデータ行で1回だけ生成
 */
const parseCsvToMemory = (
  fileData: FileData,
  datasetType: DatasetType,
  onProgress: (rowCount: number) => void,
): Promise<ParsedCsvData> => {
  mainProcessLogger.info(
    `CSV parsing started - fileName: ${fileData.name}, path: ${fileData.path}`,
  );
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    const headers: string[] = [];
    const unmappedColumns: string[] = [];
    let lastReportedCount = 0;
    let hasError = false; // エラー発生フラグ

    // カラムマッピングを事前計算（最初のデータ行で1回だけ生成）
    let columnMap: Map<string, string> | null = null;
    const excludeColumns = new Set(["geometry", "fid", "distance"]);
    const skipColumns = new Set(["_id", "_created_at", "_updated_at", "id"]);

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    createReadStream(fileData.path, { encoding: "utf8" })
      .pipe(parser)
      .on("data", (row: Record<string, string>) => {
        // 最初のデータ行でカラムマッピングを構築
        if (!columnMap) {
          const headerRow = Object.keys(row);
          headers.push(...headerRow);

          columnMap = new Map<string, string>();
          for (const originalKey of headerRow) {
            // 元のキーがスキップ対象の場合はスキップ
            if (skipColumns.has(originalKey)) continue;

            // 既に英語カラム名の場合はそのまま使用
            if (isEnglishColumn(originalKey, datasetType)) {
              columnMap.set(originalKey, originalKey);
              continue;
            }

            // 日本語カラム名の場合は英語に変換
            const enKey = translateColumnToEnglish(originalKey, datasetType);

            // 変換後のキーがスキップ対象の場合もスキップ（idなど）
            if (skipColumns.has(enKey)) continue;

            // 変換できなかった場合（元のキーが返ってきた場合）、未マップカラムとして記録
            // _odsサフィックスのカラムは説明変数追加用データなので警告不要
            if (
              enKey === originalKey &&
              !excludeColumns.has(originalKey) &&
              !originalKey.endsWith(ODS_SUFFIX)
            ) {
              unmappedColumns.push(originalKey);
              mainProcessLogger.warn(
                `Column translation warning for ${datasetType} - unmapped column: ${originalKey}`,
              );
            }

            columnMap.set(originalKey, enKey);
          }
        }

        // 事前計算したマッピングを使用して高速に変換
        const convertedData: Record<string, string> = {};
        for (const [jpKey, value] of Object.entries(row)) {
          const enKey = columnMap.get(jpKey);
          if (enKey) {
            convertedData[enKey] = value;
          }
        }

        // _odsカラムをoptional_data_source JSONに変換（buildingsのみ）
        if (datasetType === "building") {
          const { row: rowWithoutOds, odsEntries } =
            collectOdsColumns(convertedData);
          if (odsEntries) {
            (rowWithoutOds as Record<string, unknown>).optional_data_source =
              odsEntries;
          }
          rows.push(rowWithoutOds);
        } else {
          rows.push(convertedData);
        }

        // 進捗通知（5000行ごと）
        if (rows.length - lastReportedCount >= PROGRESS_INTERVAL) {
          onProgress(rows.length);
          lastReportedCount = rows.length;
        }
      })
      .on("end", () => {
        // エラー発生時は end イベントでの処理をスキップ
        if (hasError) return;

        // 最終進捗を通知
        onProgress(rows.length);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        mainProcessLogger.info(
          `CSV parsing completed - fileName: ${fileData.name}, rows: ${rows.length}, unmapped: ${unmappedColumns.length}, elapsed: ${elapsed}s`,
        );
        resolve({ rows, headers, unmappedColumns });
      })
      .on("error", (err) => {
        hasError = true;
        reject(new Error(formatCsvErrorMessage(err.message)));
      });
  });
};
