import { dialog } from "electron";
import { writeFileSync } from "fs";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export interface ExportChartCsvArgs {
  csvContent: string;
  defaultFileName: string;
}

export const exportChartCsv = (async (
  event,
  { csvContent, defaultFileName }: ExportChartCsvArgs,
) => {
  try {
    const result = await dialog.showSaveDialog({
      title: "CSVファイルの保存先を選択",
      defaultPath: defaultFileName,
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      mainProcessLogger.info("CSV export was canceled by user");
      return { success: false, canceled: true };
    }

    // BOM（Byte Order Mark）を追加してCSVファイルを保存
    // WindowsのExcelで日本語を正しく表示するために必要
    const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
    const contentBuffer = Buffer.from(csvContent, "utf-8");
    writeFileSync(result.filePath, Buffer.concat([BOM, contentBuffer]));

    mainProcessLogger.info(
      `CSV file exported successfully: ${result.filePath}`,
    );
    return { success: true, filePath: result.filePath };
  } catch (error) {
    mainProcessLogger.error("Failed to export CSV file", error as Error);
    throw error;
  }
}) satisfies IpcMainListener;
