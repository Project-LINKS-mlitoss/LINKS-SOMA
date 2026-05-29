import { useEffect, useState } from "react";
import { type View } from "../../types/models/view";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

export const useMapAllCount = ({
  dataSetResultId,
  unit,
}: {
  dataSetResultId: View["dataSetResultId"];
  unit: View["unit"];
}): { allCount: number | null } => {
  const [allCount, setAllCount] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const result = await window.ipcRenderer.invoke("selectDataSetCount", {
        dataSetResultId,
        unit,
      });
      setAllCount(result.count);
    })().catch((error) => {
      rendererLogger.error("Failed to fetch map data count", {
        error,
        dataSetResultId,
        unit,
      });
    });
  }, [dataSetResultId, unit]);

  return { allCount };
};
