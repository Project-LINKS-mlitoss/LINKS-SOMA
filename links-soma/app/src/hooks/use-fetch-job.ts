import { type SWRResponse } from "swr";
import useSWRImmutable from "swr/immutable";
import { type SelectJob } from "../schema";

interface Params {
  id: SelectJob["id"] | undefined;
}

type Result = SelectJob | undefined;

const fetcher = async ({ id }: Params): Promise<Result> => {
  if (!id) return undefined;

  const result = await window.ipcRenderer.invoke("selectJob", {
    id,
  });

  return result;
};

export const useFetchJob = ({ id }: Params): SWRResponse<Result> => {
  const swr = useSWRImmutable(
    {
      id,
      key: useFetchJob.name,
    },
    fetcher,
  );
  return swr;
};
