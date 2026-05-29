import { useState, useEffect, useCallback } from "react";
import { type PaginatedJobsResponse } from "../ipc/select-jobs-with-pagination";
import { subscribeJobChanged } from "./job-change-notifier";

type SelectJobsParams = {
  jobId?: number;
  type?: "preprocess" | "ml" | "result" | "export" | "join_check" | null;
  page?: number;
  limitPerPage?: number;
  /** 下書きを除外するかどうか */
  excludeDraft?: boolean;
};

export type UseFetchJobsWithPaginationResult = {
  data: PaginatedJobsResponse | undefined;
  mutate: () => Promise<void>;
};

/**
 * 処理一覧 (ページネーション) を取得する hook。
 *
 * SWR を使わず local state + 直接 IPC にしている理由 (issue #1796):
 * - SWR の dedupingInterval により「下書き作成→別画面遷移→復帰」の流れで
 *   stale なキャッシュが返り、作成直後の draft が処理一覧に表示されない
 * - job-change-notifier で create/update/delete 後に refetch を強制する
 * - params 変化 (pagination) は fetch の closure 差で自然に再取得される
 */
export const useFetchJobsWithPagination = ({
  jobId,
  type,
  page,
  limitPerPage,
  excludeDraft,
}: SelectJobsParams = {}): UseFetchJobsWithPaginationResult => {
  const [data, setData] = useState<PaginatedJobsResponse | undefined>(
    undefined,
  );

  const fetch = useCallback(async (): Promise<void> => {
    const result = (await window.ipcRenderer.invoke(
      "selectJobsWithPagination",
      {
        jobId,
        type,
        page,
        limitPerPage,
        excludeDraft,
      },
    )) as PaginatedJobsResponse;
    setData(result);
  }, [jobId, type, page, limitPerPage, excludeDraft]);

  useEffect(() => {
    void fetch();
    const unsubscribe = subscribeJobChanged(() => {
      void fetch();
    });
    return unsubscribe;
  }, [fetch]);

  return { data, mutate: fetch };
};
