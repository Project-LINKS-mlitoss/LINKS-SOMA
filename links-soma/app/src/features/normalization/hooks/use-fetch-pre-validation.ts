import useSWR, { type SWRResponse } from "swr";
import {
  type preValidateDatasetArgs,
  type PreValidationItem,
} from "../ipc/pre-validate-dataset";

const fetcher = ([{ filename, schemaKey, columns, columnLabels, references }]: [
  preValidateDatasetArgs,
  string,
]): Promise<PreValidationItem[]> =>
  window.ipcRenderer.invoke("preValidateDataset", {
    filename,
    schemaKey,
    columns,
    columnLabels,
    references,
  });

/**
 * データセットの事前軽量チェック結果（サンプリング・三値・目安）を取得する。
 * カタログ未登録・ファイル未選択では空配列が返る。
 */
export const useFetchPreValidation = ({
  filename,
  schemaKey,
  columns,
  columnLabels,
  references,
}: preValidateDatasetArgs): SWRResponse<PreValidationItem[]> =>
  useSWR(
    filename && schemaKey
      ? [
          { filename, schemaKey, columns, columnLabels, references },
          "useFetchPreValidation",
        ]
      : null,
    fetcher,
  );
