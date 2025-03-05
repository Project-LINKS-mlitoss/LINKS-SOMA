import useSWR, { type SWRResponse } from "swr";
import { type SelectRawDataSet } from "../schema";

type Params = {
  id: SelectRawDataSet["id"];
};

type Response = SelectRawDataSet | undefined;

const fetcher = ([id]: [Params["id"], string]): Promise<Response> => {
  const result = window.ipcRenderer.invoke("selectRawDataset", {
    id,
  });
  return result;
};

export const useFetchRawDataset = ({ id }: Params): SWRResponse<Response> => {
  const swr = useSWR([id, useFetchRawDataset.name], fetcher);
  return swr;
};
