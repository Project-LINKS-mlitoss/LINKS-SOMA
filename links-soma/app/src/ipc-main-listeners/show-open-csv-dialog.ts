import path from "path";
import { dialog, BrowserWindow } from "electron";
import { type IpcMainListener } from ".";

type Params = {
  title?: string;
};

type Result = {
  canceled: boolean;
  filePath: string | null;
  fileName: string | null;
};

/**
 * CSVファイル選択ダイアログを表示する
 * Electronのネイティブダイアログを使用してファイルパスを確実に取得
 */
export const showOpenCsvDialog = (async (
  _: unknown,
  params?: Params,
): Promise<Result> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog(
    focusedWindow ?? BrowserWindow.getAllWindows()[0],
    {
      title: params?.title ?? "CSVファイルを選択",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
      properties: ["openFile"],
    },
  );

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePath: null, fileName: null };
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);

  return { canceled: false, filePath, fileName };
}) satisfies IpcMainListener;
