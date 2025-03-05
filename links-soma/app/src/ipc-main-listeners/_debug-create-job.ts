import { spawn } from "child_process";
import { sql } from "drizzle-orm";
import {
  jobs,
  type InsertJob,
  job_tasks,
  job_results,
  type InsertJobTask,
} from "../schema";
import { db, dbDirectory, dbPath } from "../utils/db";
import {
  type PreprocessParameters,
  type ModelCreateParameters,
  type ExportParameters,
} from "../@types/job-parameters";
import { type IpcMainListener } from ".";

type Params = {
  job: "処理開始" | "処理完了" | "処理失敗";
  jobType: InsertJob["type"];
};

export const _debugCreateJob = (async (
  _: unknown,
  { job, jobType }: Params,
): Promise<void> => {
  const cp = spawn("echo", ["test"], {
    detached: true,
  });

  const output_path = dbDirectory;
  const database_path = dbPath;

  await db.transaction(async (tx) => {
    const { insertedId } = tx
      .insert(jobs)
      .values({
        status:
          job === "処理開始" ? "" : job === "処理完了" ? "complete" : "error",
        type: jobType,
        is_named: false,
        process_id: cp.pid,
        parameters: {
          ...createmock(jobType),
          output_path,
          database_path,
        },
      })
      .returning({ insertedId: jobs.id })
      .get();

    if (job === "処理開始") {
      await tx.insert(job_tasks).values({
        job_id: insertedId,
        progress_percent: "",
        preprocess_type: null,
      });
      return;
    }
    if (job === "処理完了") {
      if (jobType === "preprocess") {
        await tx.insert(job_tasks).values({
          job_id: insertedId,
          progress_percent: "100",
          preprocess_type: "e014",
          finished_at: sql`(CURRENT_TIMESTAMP)`,
          result: {
            taskResultType: "preprocess",
            joining_rate: "93.21",
            input_source: ["住基", "水道"],
          },
        });
        await tx.insert(job_tasks).values({
          job_id: insertedId,
          progress_percent: "100",
          preprocess_type: "e016",
          finished_at: sql`(CURRENT_TIMESTAMP)`,
          result: {
            taskResultType: "preprocess",
            joining_rate: "73.21",
            input_source: ["住基", "水道"],
          },
        });
      } else {
        await tx.insert(job_tasks).values({
          job_id: insertedId,
          progress_percent: "100",
          preprocess_type: null,
          finished_at: sql`(CURRENT_TIMESTAMP)`,
          result: createmockResult(jobType),
        });
      }
      await tx.insert(job_results).values({
        job_id: insertedId,
        file_path: "py_results.csv",
      });
      return;
    }
    if (job === "処理失敗") {
      await tx.insert(job_tasks).values({
        job_id: insertedId,
        progress_percent: "",
        preprocess_type: null,
        finished_at: sql`(CURRENT_TIMESTAMP)`,
        error_code: "undefined_error",
      });
      return;
    }
  });
}) satisfies IpcMainListener;

const createmock = (
  type: InsertJob["type"],
): PreprocessParameters | ModelCreateParameters | ExportParameters => {
  switch (type) {
    case "preprocess":
      return mockE001;
    case "ml":
      return { parameterType: "ml", ...mockBuildModel };
    case "export":
      return {
        parameterType: "export",
        output_file_type: "csv",
        output_coordinate: "4326",
        data_set_results_id: 1,
        target_unit: "building",
        reference_date: "2022-01-01",
      };
    default:
      return mockE001;
  }
};

const createmockResult = (type: InsertJob["type"]): InsertJobTask["result"] => {
  switch (type) {
    case "preprocess":
      return {
        taskResultType: "preprocess",
        joining_rate: "0.4321",
        input_source: ["住基", "水道"],
      };
    case "ml":
      return {
        taskResultType: "model_create",
        accuracy: "72.82", // 正解率
        f1Score: "23", // f値
        specificity: "32.21", // 特異度
        precision: "32.21", // 適合率
        recall: "48.32", // 再現率
        important_columns: [
          {
            column: "水道使用量",
            value: "0.5324",
          },
          {
            column: "",
            value: "",
          },
        ],
      };
    default:
      return {
        taskResultType: "preprocess",
        joining_rate: "0",
        input_source: ["住基", "水道"],
      };
  }
};

/** 型推論が通じないので指定。モックなので一旦気にしない・・ */
const mockE001: PreprocessParameters = {
  parameterType: "preprocess",
  settings: {
    reference_data: "resident_registry",
    reference_date: "2021-01-01",
    advanced: {
      similarity_threshold: 0.95,
      n_gram_size: 2,
      joining_method: "intersection",
    },
  },
  data: {
    resident_registry: {
      id: 1,
      path: "ee71475f-2287-4a9e-8cb3-b41d70f6c610.csv",
      columns: {
        household_code: "15歳未満人数",
        gender: "世帯コード",
        address: "世帯コード",
        birth_date: "世帯コード",
        resident_date: "15歳以上64歳以下構成比",
      },
    },
    water_status: {
      id: 1,
      path: "ee71475f-2287-4a9e-8cb3-b41d70f6c610.csv",
      columns: {
        water_supply_number: "世帯コード",
        water_disconnection_date: "世帯コード",
        water_connection_date: "世帯コード",
        water_disconnection_flag: "世帯コード",
        address: "世帯コード",
      },
    },
    water_usage: {
      id: 2,
      path: "ee71475f-2287-4a9e-8cb3-b41d70f6c610.csv",
      columns: {
        water_supply_number: "世帯コード",
        water_usage: "世帯コード",
        water_recorded_date: "世帯コード",
      },
    },
    land_registry: {
      id: 0,
      path: "",
      columns: {
        address: "",
        structure_name: "",
        registration_date: "",
      },
    },
    vacant_house: {
      id: 0,
      path: "",
      columns: {
        address: "",
      },
    },
    geocoding: {
      id: 0,
      path: "",
      columns: {
        address: "",
        latitude: "",
        longitude: "",
      },
    },
    building_polygon: {
      id: 0,
      path: "",
      columns: {
        geometry: "",
      },
      input_file_type: "csv",
      data_type: "plateau",
    },
    census: {
      id: 0,
      path: "",
    },
  },
};

const mockBuildModel = {
  input_path: "test.csv",
  settings: {
    explanatory_variables: ["水道番号", "メータ番号"],
    advanced: {
      test_size: 0.3,
      n_splits: 3,
      undersample: true,
      undersample_ratio: 3,
      threshold: 0.3,
      hyperparameter_flag: false,
      n_trials: 100,
      lambda_l1: 0,
      lambda_l2: 0,
      num_leaves: 31,
      feature_fraction: 1,
      bagging_fraction: 1,
      bagging_freq: 0,
      min_data_in_leaf: 20,
    },
  },
};
