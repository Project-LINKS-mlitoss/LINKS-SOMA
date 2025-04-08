import { useParams, useSearchParams } from "react-router-dom";

type UseWorkbookIdsSearchQueryReturnType = {
  workbookId: string;
  sheetId: string | null;
  viewId: string | null;
};

/** URLのクエリパラメータから取得 */
export const useWorkbookIdsSearchQuery =
  (): UseWorkbookIdsSearchQueryReturnType => {
    /** @fixme `analysis/workbook/:id/edit` 配下じゃなければ使えない旨のバリデーションをしたい */
    const { id } = useParams();
    const [URLSearchParams] = useSearchParams();
    const sheetId = URLSearchParams.get("sheetId");
    const viewId = URLSearchParams.get("viewId");

    return {
      workbookId: id || "",
      sheetId,
      viewId,
    };
  };
