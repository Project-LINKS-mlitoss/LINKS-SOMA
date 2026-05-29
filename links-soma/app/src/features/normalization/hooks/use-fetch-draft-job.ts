import { useState, useEffect, useCallback } from "react";
import { type SelectJob } from "../../../db/schema";
import { subscribeJobChanged } from "../../job/hooks/job-change-notifier";

type Result = SelectJob | null;

export type UseFetchDraftJobResult = {
  data: Result | undefined;
  mutate: () => Promise<void>;
};

/**
 * 下書き (status="draft", type="preprocess") の job を取得する hook。
 *
 * SWR を使わず local state + 直接 IPC にしている理由 (issue #1796):
 * - 消費 component は Normalization 1 箇所のみ、query は 1 行検索で ≪1ms
 * - SWR の dedupingInterval による caching が、下書き作成→別画面遷移→復帰
 *   の流れで stale null を返し、ユーザが「下書きが消えた」と知覚するバグを起こしていた
 * - job-change-notifier で create/update/delete 後に refetch を強制することで
 *   UI と DB の整合を保つ
 */
export const useFetchDraftJob = (): UseFetchDraftJobResult => {
  const [data, setData] = useState<Result | undefined>(undefined);

  const fetch = useCallback(async (): Promise<void> => {
    const result = (await window.ipcRenderer.invoke(
      "selectDraftJob",
    )) as Result;
    setData(result);
  }, []);

  useEffect(() => {
    void fetch();
    const unsubscribe = subscribeJobChanged(() => {
      void fetch();
    });
    return unsubscribe;
  }, [fetch]);

  return { data, mutate: fetch };
};
