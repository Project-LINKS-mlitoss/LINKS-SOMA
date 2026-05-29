import { type SWRResponse } from "swr";
import useSWRImmutable from "swr/immutable";
import {
  type ResolveJobFileNamesRequest,
  type ResolveJobFileNamesResponse,
} from "../types/resolve-job-file-names";

const fetcher = async (
  params: ResolveJobFileNamesRequest,
): Promise<ResolveJobFileNamesResponse> => {
  return await window.ipcRenderer.invoke("resolveJobFileNames", params);
};

/**
 * job.parameters内のUUIDパスやIDからユーザー表示名を一括解決する
 * リクエストが空（解決対象がない）場合はIPCを呼び出さない
 */
export const useResolveJobFileNames = (
  params: ResolveJobFileNamesRequest,
): SWRResponse<ResolveJobFileNamesResponse> => {
  const hasRequest =
    (params.rawPaths && params.rawPaths.length > 0) ||
    (params.normalizedPaths && params.normalizedPaths.length > 0) ||
    !!params.modelPath ||
    !!params.dataSetResultId ||
    !!params.viewId;

  return useSWRImmutable(
    hasRequest ? { ...params, key: "useResolveJobFileNames" } : null,
    hasRequest ? () => fetcher(params) : null,
  );
};
