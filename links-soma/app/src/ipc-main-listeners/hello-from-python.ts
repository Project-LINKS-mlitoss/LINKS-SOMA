import { getErrorMessage } from "../utils/get-error-message";
import { binaryPath, execFileAsync, type IpcMainListener } from ".";

// TODO: Pythonスクリプトを呼び出すサンプル。いずれ削除する
export const helloFromPython = (async (
  _: unknown,
  name: string,
): Promise<string | undefined> => {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath("hello"), [name]);

    if (stderr) {
      throw new Error(`Stderr: ${stderr}`);
    }

    return stdout;
  } catch (error) {
    console.error(getErrorMessage(error));
    return undefined;
  }
}) satisfies IpcMainListener;
