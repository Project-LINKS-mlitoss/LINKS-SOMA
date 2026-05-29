import { useSearchParams } from "react-router-dom";
import { type ResultDataSetUnit } from "../components/dataset/result-dataset-table/types";

type SearchQueryReturnType = {
  previewId?: string;
  previewType?: ResultDataSetUnit;
};

/** URLのクエリパラメータから取得 */
export const usePreviewSearchQuery = (): SearchQueryReturnType => {
  const [URLSearchParams] = useSearchParams();
  const previewId = URLSearchParams.get("previewId");
  const previewType = URLSearchParams.get("previewType");

  return {
    previewId: previewId ?? undefined,
    previewType: (previewType as ResultDataSetUnit) ?? undefined,
  };
};
