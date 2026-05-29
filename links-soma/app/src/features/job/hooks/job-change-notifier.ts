/**
 * ジョブの create/update/delete を横断的に通知する軽量な pub/sub。
 *
 * 複数の React hook (useFetchDraftJob / useFetchJobsWithPagination) が
 * 同じ DB 状態を別観点で読む都合上、片方で mutation が起きたら他方にも
 * 再取得を促す必要がある。SWR の global cache invalidation に代わる仕組み。
 */

const JOB_CHANGED_EVENT = "links-akiya:job-changed";

/**
 * ジョブ状態が変わったことを全リスナに通知する (create/update/delete 直後に呼ぶ)
 */
export const notifyJobChanged = (): void => {
  window.dispatchEvent(new CustomEvent(JOB_CHANGED_EVENT));
};

/**
 * ジョブ変更イベントを購読する (hook の useEffect 内で使う)
 * @returns 解除関数
 */
export const subscribeJobChanged = (handler: () => void): (() => void) => {
  window.addEventListener(JOB_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(JOB_CHANGED_EVENT, handler);
  };
};
