import { jobs, type SelectJob } from "../../db/schema";
import { db } from "../../db/client";
import { mainProcessLogger } from "../../shared/utils/main-process-logger";
import { type JobParameters } from "../../shared/types/job-parameters";

type Params = {
  jobType: SelectJob["type"];
  parameters: JobParameters;
};

type ReturnParams =
  | {
      status: "success";
      data: {
        jobId: number;
      };
    }
  | {
      status: "failed";
      data: {
        jobId: null;
      };
    };

export const startJobProcess = async ({
  jobType,
  parameters,
}: Params): Promise<ReturnParams> => {
  try {
    const { jobId } = db
      .insert(jobs)
      .values({
        status: "",
        type: jobType,
        is_named: false,
        parameters,
      })
      .returning({
        jobId: jobs.id,
      })
      .get();

    return {
      status: "success",
      data: {
        jobId,
      },
    };
  } catch (error) {
    mainProcessLogger.error(
      `Error starting job process - jobType: ${jobType}`,
      error as Error,
    );
    return {
      status: "failed",
      data: {
        jobId: null,
      },
    };
  }
};
