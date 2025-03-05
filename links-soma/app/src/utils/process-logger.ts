import { type ChildProcessWithoutNullStreams } from "child_process";

/** processのログを吐く関数. 仮 */
export const processLogger = (cp: ChildProcessWithoutNullStreams): void => {
  cp.stdout.on("data", (data) => {
    console.info("[stdout]" + data);
  });
  cp.stderr.on("data", (data) => {
    console.error("[stderr]" + data);
  });
};
