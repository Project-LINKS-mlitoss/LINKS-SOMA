import { useState } from "react";
import { type BarView, type LineView, type PieView } from "../types";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
import { exportChartCsv } from "../util/export";
import { type ExportChartProps } from "../util/export/chart-data-transformer";

type Params = {
  view: LineView | BarView | PieView;
  exportChartProps: ExportChartProps;
};

export const useChartCsvExport = ({
  view,
  exportChartProps,
}: Params): {
  isExporting: boolean;
  handleChartCsvExport: () => Promise<void>;
} => {
  const [isExporting, setIsExporting] = useState(false);

  const handleChartCsvExport = async (): Promise<void> => {
    if (!view || !exportChartProps) {
      rendererLogger.warn(
        "Chart view or props not available for CSV export",
        undefined,
        {
          component: "DownloadDialog",
        },
      );
      return;
    }

    try {
      setIsExporting(true);
      const { csvContent, fileName } = exportChartCsv(view, exportChartProps);

      const result = await window.ipcRenderer.invoke("exportChartCsv", {
        csvContent,
        defaultFileName: fileName,
      });

      if (result.success) {
        rendererLogger.info("Chart CSV export completed successfully", {
          fileName: result.filePath,
        });
      } else if (result.canceled) {
        rendererLogger.info("Chart CSV export was canceled by user");
      }
    } catch (error) {
      rendererLogger.error("Failed to export chart CSV", error, {
        component: "DownloadDialog",
        chartType: view?.style,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, handleChartCsvExport };
};
