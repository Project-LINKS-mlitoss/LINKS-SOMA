import useSWR, { type SWRResponse } from "swr";
import { type ViewTemplateListItem } from "../../ipc/select-view-templates";

const fetcher = (): Promise<ViewTemplateListItem[]> =>
  window.ipcRenderer.invoke("selectViewTemplates");

/**
 * ビューテンプレート一覧（SOMA 提供プリセット + ユーザー保存分）を取得するフック (FR021)。
 */
export const useFetchViewTemplates = (): SWRResponse<ViewTemplateListItem[]> =>
  useSWR("useFetchViewTemplates", fetcher);
