import useSWR, { type SWRResponse } from "swr";
import { type SelectJobTask } from "../schema";

type Params = {
  jobId: SelectJobTask["job_id"];
};

const fetcher = async ({ jobId }: Params): Promise<SelectJobTask[]> => {
  const result = await window.ipcRenderer.invoke("selectJobTasks", jobId);

  /**
   * job_tasks.result に入っているJsonの型が取得時に判別できないためここで設定
   * Python側で詰めてもらうほうが良いかもしれないが一旦
   * 設定の基準: task.preprocess_type があるかどうか.現時点では判別可能
   */
  result.forEach((task, index) => {
    if (task.preprocess_type) {
      result[index].result = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 理由は上段の通り
        // @ts-ignore
        taskResultType: "preprocess",
        ...result[index].result,
      };
    } else {
      result[index].result = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 理由は上段の通り
        // @ts-ignore
        taskResultType: "model_create",
        ...result[index].result,
      };
    }
  });

  return result;
};

export const useFetchJobTasks = ({
  jobId,
}: Params): SWRResponse<SelectJobTask[]> => {
  const swr = useSWR(
    {
      jobId,
      key: useFetchJobTasks.name,
    },
    fetcher,
  );
  return swr;
};
