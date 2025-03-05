import { spawn } from "child_process";
import { getErrorMessage } from "../../utils/get-error-message";
import { dbDirectory, dbPath } from "../../utils/db";
import { binaryPath, type IpcMainListener } from "..";
import { processLogger } from "../../utils/process-logger";
import { type PreprocessParameters } from "../../@types/job-parameters";

export const execE001 = (async (
  _: unknown,
  {
    parameters,
  }: {
    parameters: PreprocessParameters;
  },
): Promise<true | false> => {
  try {
    const output_path = dbDirectory;
    const database_path = dbPath;

    const postParameters = {
      ...parameters,
      output_path,
      database_path,
    };

    // eslint-disable-next-line no-console -- for debug @todo remove
    console.log("--- start execE001 ---", postParameters);

    // childProcessに入れてバックグラウンド実行
    const cp = spawn(
      binaryPath("IF001"),
      ["--parameters", JSON.stringify(JSON.stringify(postParameters))],
      {
        detached: true,
      },
    );

    processLogger(cp);

    return true;
  } catch (error) {
    console.error(getErrorMessage(error));
    return false;
  }
}) satisfies IpcMainListener;
