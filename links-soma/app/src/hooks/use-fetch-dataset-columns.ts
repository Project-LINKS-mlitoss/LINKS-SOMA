import useSWR, { type SWRResponse } from "swr";
import { type readDatasetColumnsArgs } from "../ipc-main-listeners/read-dataset-columns";

const fetcher = ([{ filename }]: [readDatasetColumnsArgs, string]): Promise<
  string[] | undefined
> => {
  const result = window.ipcRenderer.invoke("readDatasetColumns", {
    filename,
  });
  return result;
};

export const useFetchDatasetColumns = ({
  filename,
}: readDatasetColumnsArgs): SWRResponse<string[] | undefined> => {
  const swr = useSWR(
    [
      {
        filename,
      },
      "useFetchDatasetColumns",
    ],
    fetcher,
  );
  return swr;
};
