import { join } from "path";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { eq } from "drizzle-orm";
import { db, dbDirectory } from "../db/client";
import {
  job_results,
  job_tasks,
  jobs,
  model_files,
  type InsertJob,
} from "../db/schema";
import { mainProcessLogger } from "../shared/utils/main-process-logger";
import { type ModelCreateTaskResult } from "../shared/types/job-task-result";
import modelAccuracy from "./model_accuracy.json";

const isDev = process.env.NODE_ENV === "development";

/** プリセットモデルのファイル名 */
const PRESET_MODEL_FILE = "preset_model.zip" as const;

/** プリセットモデルの表示名 */
const PRESET_MODEL_NAME = "汎用モデル";

/** プリセットモデルの説明 */
const PRESET_MODEL_NOTE =
  "愛知県岡崎市・豊田市・豊橋市、埼玉県熊谷市、山口県下関市のデータで空き家の特徴を学習し、水道・住民基本台帳のデータから空き家を推定する機械学習モデル";

const accuracy: ModelCreateTaskResult = {
  taskResultType: "model_create",
  precisionAt100: modelAccuracy.precisionAt100.toString(),
  precisionAt500: modelAccuracy.precisionAt500.toString(),
  precisionAt1000: modelAccuracy.precisionAt1000.toString(),
  precisionAt3000: modelAccuracy.precisionAt3000.toString(),
  precisionAt5000: modelAccuracy.precisionAt5000.toString(),
  liftAt1000: modelAccuracy.liftAt1000.toString(),
  liftAt5000: modelAccuracy.liftAt5000.toString(),
  recallTarget: modelAccuracy.recallTarget.toString(),
  threshold: modelAccuracy.threshold.toString(),
  candidateCount: modelAccuracy.candidateCount.toString(),
  candidateRatio: modelAccuracy.candidateRatio.toString(),
  important_columns: modelAccuracy.important_columns.map((item) => ({
    column: item.column,
    value: item.value.toString(),
  })),
};

export async function presetModels(): Promise<void> {
  try {
    mainProcessLogger.info("Starting preset models process");

    const preparedModelsPath = isDev
      ? join(__dirname, "../../public/prepared-models")
      : join(process.resourcesPath, "prepared-models");

    mainProcessLogger.info(`Prepared models path: ${preparedModelsPath}`);

    if (!existsSync(preparedModelsPath)) {
      mainProcessLogger.warn(
        "Prepared models directory not found, skipping preset",
      );
      return;
    }

    const sourcePath = join(preparedModelsPath, PRESET_MODEL_FILE);
    if (!existsSync(sourcePath)) {
      mainProcessLogger.warn(
        `Preset model file not found: ${PRESET_MODEL_FILE}, skipping preset`,
      );
      return;
    }

    // モデルファイルは database/ ディレクトリに統一して配置
    // save-file.ts や db/client.ts と同じディレクトリを使用
    const internalModelsPath = dbDirectory;
    if (!existsSync(internalModelsPath)) {
      mkdirSync(internalModelsPath, { recursive: true });
      mainProcessLogger.info(
        `Created internal models directory: ${internalModelsPath}`,
      );
    }

    const destPath = join(internalModelsPath, PRESET_MODEL_FILE);

    await db.transaction(async (tx) => {
      // 重複コピーを防ぐためのチェック
      if (existsSync(destPath)) {
        mainProcessLogger.info(
          `Model file already exists, skipping copy: ${PRESET_MODEL_FILE}`,
        );

        // DBに既に登録されているかチェック
        const existingModel = tx
          .select()
          .from(model_files)
          .where(eq(model_files.file_path, PRESET_MODEL_FILE))
          .limit(1)
          .all();

        if (existingModel.length > 0) {
          mainProcessLogger.info(
            `Model file already registered in database: ${PRESET_MODEL_FILE}`,
          );
          return;
        }
        mainProcessLogger.info(
          `Model file exists but not in database, will register: ${PRESET_MODEL_FILE}`,
        );
      } else {
        copyFileSync(sourcePath, destPath);
        mainProcessLogger.info(`Copied model file: ${PRESET_MODEL_FILE}`);
      }

      const job = tx
        .insert(jobs)
        .values(_jobValue)
        .returning({ id: jobs.id })
        .get();

      tx.insert(job_tasks)
        .values({
          job_id: job.id,
          result: accuracy,
        })
        .run();

      // ダウンロード機能に必要（ML詳細画面はjob_results.file_pathからファイルを取得する）
      tx.insert(job_results)
        .values({
          job_id: job.id,
          file_path: PRESET_MODEL_FILE,
        })
        .run();

      tx.insert(model_files)
        .values({
          file_name: PRESET_MODEL_NAME,
          file_path: PRESET_MODEL_FILE,
          created_by_job_id: job.id,
          note: PRESET_MODEL_NOTE,
        })
        .run();

      mainProcessLogger.info(
        `Registered preset model in database: ${PRESET_MODEL_FILE}`,
      );
    });

    mainProcessLogger.info("Preset models process completed successfully");
  } catch (error) {
    mainProcessLogger.error("Preset models process failed", error as Error);
    throw error;
  }
}

const _jobValue: InsertJob = {
  type: "ml",
  status: "complete",
  is_named: true,
  parameters: {
    parameterType: "ml",
    input_path: "",
    database_path: "",
    settings: {
      advanced: {},
      explanatory_variables: [],
    },
  },
};
