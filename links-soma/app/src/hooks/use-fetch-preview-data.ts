import useSWR, { type SWRResponse } from "swr";
import { type PreviewData } from "../ipc-main-listeners/select-building-preview";

const fetcher = async (dataSetResultId: number): Promise<PreviewData[]> => {
  const result: PreviewData[] = await window.ipcRenderer.invoke(
    "selectBuildingPreview",
    {
      dataSetResultId,
    },
  );
  return result;
};

export const useFetchBuildingPreview = (
  dataSetResultId: number,
): SWRResponse<PreviewData[]> => {
  const swr = useSWR(["selectBuildingPreview", dataSetResultId], () =>
    fetcher(dataSetResultId),
  );
  return swr;
};
