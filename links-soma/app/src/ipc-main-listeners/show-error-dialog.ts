import { dialog } from "electron";
import { type IpcMainListener } from ".";

export type ShowErrorDialogArg = {
  title: string;
  message: string;
};

/**
 * エラーダイアログを表示
 * レンダラープロセスからElectron標準ダイアログを表示するためのIPC Handler
 */
export const showErrorDialog = (async (
  _: unknown,
  { title, message }: ShowErrorDialogArg,
): Promise<void> => {
  dialog.showErrorBox(title, message);
}) satisfies IpcMainListener;
